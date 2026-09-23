import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = {
  params: Promise<{ owner: string; repo: string; number: string; id: string }>;
};

const updateSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  resolved: z.boolean().optional(),
});

// PATCH /api/v1/repositories/[owner]/[repo]/pulls/[number]/comments/[id]
export async function PATCH(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr, id: commentId } = await context.params;
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

  const comment = await prisma.pullRequestComment.findUnique({
    where: { id: commentId },
    include: {
      author: { select: { id: true, username: true } },
    },
  });
  if (!comment || comment.pullRequestId !== pullRequest.id) {
    return apiError("NOT_FOUND", "Comment not found", null, 404);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { body: newBody, resolved } = parsed.data;

  // Authorization checks
  const isAuthor = comment.authorId === userId;
  const isPrAuthor = pullRequest.authorId === userId;
  const isRepoManager = viewer.canAdmin || viewer.canWrite;

  if (newBody !== undefined && !isAuthor && !isRepoManager) {
    return apiError("FORBIDDEN", "Cannot edit another user's comment", null, 403);
  }

  if (resolved !== undefined && !isAuthor && !isPrAuthor && !isRepoManager) {
    return apiError("FORBIDDEN", "Cannot resolve or unresolve this conversation", null, 403);
  }

  try {
    const updateData: any = {};

    if (newBody !== undefined) {
      updateData.body = newBody;
    }

    if (resolved !== undefined) {
      if (resolved) {
        updateData.resolvedAt = new Date();
        updateData.resolvedById = userId;
      } else {
        updateData.resolvedAt = null;
        updateData.resolvedById = null;
      }
    }

    const updated = await prisma.pullRequestComment.update({
      where: { id: commentId },
      data: updateData,
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

    return apiOk({ comment: updated });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to update comment", null, 500);
  }
}

// DELETE /api/v1/repositories/[owner]/[repo]/pulls/[number]/comments/[id]
export async function DELETE(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr, id: commentId } = await context.params;
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

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
  });
  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  const comment = await prisma.pullRequestComment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.pullRequestId !== pullRequest.id) {
    return apiError("NOT_FOUND", "Comment not found", null, 404);
  }

  const isAuthor = comment.authorId === userId;
  const isRepoManager = viewer.canAdmin || viewer.canWrite;

  if (!isAuthor && !isRepoManager) {
    return apiError("FORBIDDEN", "Cannot delete another user's comment", null, 403);
  }

  try {
    await prisma.pullRequestComment.delete({
      where: { id: commentId },
    });

    return apiOk({ deleted: true });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to delete comment", null, 500);
  }
}
