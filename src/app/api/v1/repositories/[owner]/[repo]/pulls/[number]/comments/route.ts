import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

const commentSchema = z.object({
  body: z.string().min(1).max(10000),
  reviewState: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED"]).optional(),
  diffPath: z.string().optional(),
  diffLine: z.number().int().optional(),
});

// POST /api/v1/repositories/[owner]/[repo]/pulls/[number]/comments
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

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

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
  });
  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { body: commentText, reviewState, diffPath, diffLine } = parsed.data;

  try {
    // If reviewState is provided, also record a review
    let review = null;
    if (reviewState) {
      review = await prisma.pullRequestReview.create({
        data: {
          pullRequestId: pullRequest.id,
          reviewerId: userId,
          state: reviewState,
          body: commentText,
        },
        include: {
          reviewer: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });
    }

    // Always create a comment record
    const comment = await prisma.pullRequestComment.create({
      data: {
        pullRequestId: pullRequest.id,
        authorId: userId,
        body: commentText,
        diffPath: diffPath || null,
        diffLine: diffLine || null,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return apiOk({ comment, review }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to add comment", null, 500);
  }
}
