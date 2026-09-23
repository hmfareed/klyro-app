import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug/discussions/:threadId — get thread with full comments
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; threadId: string }> },
) {
  const { slug, threadId } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const thread = await prisma.discussionThread.findUnique({
    where: { id: threadId },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!thread || thread.projectId !== project.id) {
    return apiError("NOT_FOUND", "Discussion thread not found.", null, 404);
  }

  return apiOk({ thread });
}
