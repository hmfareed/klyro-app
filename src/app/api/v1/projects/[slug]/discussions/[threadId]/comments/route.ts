import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { createNotification } from "@/shared/notifications/create";
import { apiError, apiOk } from "@/shared/api/errors";

const commentSchema = z.object({
  body: z.string().min(1, "Comment cannot be empty.").max(5000),
});

// POST /api/v1/projects/:slug/discussions/:threadId/comments — add a comment
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; threadId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug, threadId } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canComment = await requirePermission(project.id, userId, "CONTRIBUTOR");
  if (!canComment) return apiError("FORBIDDEN", "Only active team members can participate in discussions.", null, 403);

  const thread = await prisma.discussionThread.findUnique({
    where: { id: threadId },
    select: { id: true, projectId: true, isLocked: true, title: true, authorId: true },
  });
  if (!thread || thread.projectId !== project.id) {
    return apiError("NOT_FOUND", "Thread not found.", null, 404);
  }
  if (thread.isLocked) {
    return apiError("LOCKED", "This discussion thread is locked.", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", null, 400);
  }

  const comment = await prisma.discussionComment.create({
    data: {
      threadId: thread.id,
      authorId: userId,
      body: parsed.data.body.trim(),
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  // Notify thread author if someone else commented
  if (thread.authorId !== userId) {
    await createNotification({
      userId: thread.authorId,
      type: "DISCUSSION_REPLY",
      title: `Reply on: ${thread.title}`,
      body: `${comment.author.displayName || comment.author.username} commented on your discussion thread.`,
      linkUrl: `/repositories/${project.slug}?tab=discussions&threadId=${thread.id}`,
    });
  }

  return apiOk({ comment }, 201);
}
