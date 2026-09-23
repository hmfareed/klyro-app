import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

// GET /api/v1/repositories/[owner]/[repo]/issues/[number]
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const issueNumber = parseInt(numStr, 10);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  try {
    const issue = await prisma.repositoryIssue.findFirst({
      where: { repositoryId: repository.id, number: issueNumber },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        assignee: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        comments: {
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!issue) return apiError("NOT_FOUND", "Issue not found", null, 404);

    return apiOk({ issue, viewer });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to fetch issue", null, 500);
  }
}

const updateIssueSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  body: z.string().max(10000).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  labels: z.array(z.string()).optional(),
  assigneeId: z.string().optional().nullable(),
});

// PATCH /api/v1/repositories/[owner]/[repo]/issues/[number]
export async function PATCH(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const issueNumber = parseInt(numStr, 10);

  let userId = await getSessionUserId();
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = updateIssueSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  try {
    const existing = await prisma.repositoryIssue.findFirst({
      where: { repositoryId: repository.id, number: issueNumber },
    });
    if (!existing) return apiError("NOT_FOUND", "Issue not found", null, 404);

    const isAuthor = existing.authorId === userId;
    if (!isAuthor && !viewer.canWrite) {
      return apiError("FORBIDDEN", "Only author or repository collaborators can modify this issue", null, 403);
    }

    const wasClosing = parsed.data.status === "CLOSED" && existing.status !== "CLOSED";

    const updated = await prisma.repositoryIssue.update({
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
        ...(parsed.data.labels ? { labels: parsed.data.labels } : {}),
        ...(parsed.data.assigneeId !== undefined ? { assigneeId: parsed.data.assigneeId } : {}),
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        assignee: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    if (wasClosing && repository.projectId) {
      await recordActivityEvent({
        actorId: userId,
        projectId: repository.projectId,
        type: ActivityEventType.ISSUE_RESOLVED,
        targetType: "RepositoryIssue",
        targetId: existing.id,
        metadata: {
          number: existing.number,
          title: existing.title,
          repoName: repository.name,
        },
      });
    }

    dispatchRepositoryWebhooks({
      repositoryId: repository.id,
      event: "issues",
      payload: {
        action: parsed.data.status === "CLOSED" ? "closed" : "edited",
        issue: updated,
      },
    });

    return apiOk({ issue: updated });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to update issue", null, 500);
  }
}
