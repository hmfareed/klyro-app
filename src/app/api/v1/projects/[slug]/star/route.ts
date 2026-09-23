import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";

// POST /api/v1/projects/:slug/star — toggle star
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required to star builds.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, visibility: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const existing = await prisma.projectStar.findUnique({
    where: { userId_projectId: { userId, projectId: project.id } },
  });

  if (existing) {
    await prisma.projectStar.delete({
      where: { id: existing.id },
    });
    const count = await prisma.projectStar.count({ where: { projectId: project.id } });
    return apiOk({ starred: false, starsCount: count });
  }

  await prisma.projectStar.create({
    data: {
      userId,
      projectId: project.id,
    },
  });

  // Record Activity Event
  await recordActivityEvent({
    actorId: userId,
    projectId: project.id,
    type: ActivityEventType.PROJECT_STARRED,
    visibility: project.visibility,
    metadata: {
      action: "starred",
    },
  });

  const count = await prisma.projectStar.count({ where: { projectId: project.id } });
  return apiOk({ starred: true, starsCount: count });
}
