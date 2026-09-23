import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { compareBranches } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

// GET /api/v1/repositories/[owner]/[repo]/pulls/[number]
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  try {
    const pullRequest = await prisma.pullRequest.findFirst({
      where: {
        repositoryId: repository.id,
        number: prNumber,
      },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        mergedBy: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        reviews: {
          include: {
            reviewer: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        comments: {
          where: { parentId: null },
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            resolvedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            replies: {
              include: {
                author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
                resolvedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

    // Compute review summary
    const latestByReviewer: Record<string, string> = {};
    for (const r of pullRequest.reviews) {
      latestByReviewer[r.reviewerId] = r.state;
    }
    const latestStates = Object.values(latestByReviewer);
    const reviewStats = {
      approvedCount: latestStates.filter((s) => s === "APPROVED").length,
      changesRequestedCount: latestStates.filter((s) => s === "CHANGES_REQUESTED").length,
      commentedCount: latestStates.filter((s) => s === "COMMENTED").length,
    };

    // Compute live Git comparison (commits, files, conflicts)
    let comparison = null;
    try {
      comparison = await compareBranches(
        repository.gitStoragePath,
        pullRequest.baseBranch,
        pullRequest.headBranch
      );
    } catch (err: any) {
      console.warn("[PR Compare Warning]:", err.message);
    }

    return apiOk({
      pullRequest,
      comparison,
      reviewStats,
      viewer,
    });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to fetch pull request", null, 500);
  }
}

const updatePRSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  body: z.string().max(10000).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
});

// PATCH /api/v1/repositories/[owner]/[repo]/pulls/[number] — edit, close or reopen PR
export async function PATCH(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = updatePRSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  try {
    const existing = await prisma.pullRequest.findFirst({
      where: { repositoryId: repository.id, number: prNumber },
    });
    if (!existing) return apiError("NOT_FOUND", "Pull request not found", null, 404);

    if (existing.status === "MERGED" && parsed.data.status) {
      return apiError("CANNOT_MODIFY_MERGED", "Cannot change status of an already merged pull request", null, 400);
    }

    const updated = await prisma.pullRequest.update({
      where: { id: existing.id },
      data: {
        ...(parsed.data.title ? { title: parsed.data.title } : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
        ...(parsed.data.status
          ? {
              status: parsed.data.status,
              closedAt: parsed.data.status === "CLOSED" ? new Date() : null,
            }
          : {}),
      },
    });

    return apiOk({ pullRequest: updated });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to update pull request", null, 500);
  }
}
