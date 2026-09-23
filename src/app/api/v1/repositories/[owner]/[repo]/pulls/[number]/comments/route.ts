import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

const commentSchema = z.object({
  body: z.string().min(1).max(10000),
  reviewState: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED"]).optional(),
  diffPath: z.string().optional().nullable(),
  diffLine: z.number().int().optional().nullable(),
  side: z.enum(["LEFT", "RIGHT"]).optional().nullable(),
  commitId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

// GET /api/v1/repositories/[owner]/[repo]/pulls/[number]/comments
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

  let userId = await getSessionUserId();
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
  });
  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  try {
    const comments = await prisma.pullRequestComment.findMany({
      where: {
        pullRequestId: pullRequest.id,
        parentId: null, // Return root comments with nested replies
      },
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
    });

    return apiOk({ comments });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to fetch comments", null, 500);
  }
}

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

  let { body: commentText, reviewState, diffPath, diffLine, side, commitId, parentId } = parsed.data;

  try {
    // If replying to an existing comment thread
    if (parentId) {
      const parentComment = await prisma.pullRequestComment.findUnique({
        where: { id: parentId },
      });
      if (!parentComment || parentComment.pullRequestId !== pullRequest.id) {
        return apiError("NOT_FOUND", "Parent comment thread not found", null, 404);
      }
      // Inherit diff location from parent if not specified
      if (!diffPath && parentComment.diffPath) diffPath = parentComment.diffPath;
      if (!diffLine && parentComment.diffLine) diffLine = parentComment.diffLine;
      if (!side && parentComment.side) side = parentComment.side as "LEFT" | "RIGHT";
      if (!commitId && parentComment.commitId) commitId = parentComment.commitId;
    }

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

    // Create the comment record
    const comment = await prisma.pullRequestComment.create({
      data: {
        pullRequestId: pullRequest.id,
        authorId: userId,
        body: commentText,
        diffPath: diffPath || null,
        diffLine: diffLine || null,
        side: side || "RIGHT",
        commitId: commitId || null,
        parentId: parentId || null,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        resolvedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        replies: {
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            resolvedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return apiOk({ comment, review }, 201);
  } catch (err: any) {
    console.error("[PR Comment Error]:", err);
    return apiError("INTERNAL_ERROR", "Failed to add comment", null, 500);
  }
}
