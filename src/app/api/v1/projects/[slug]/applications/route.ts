import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug/applications — list all applications for owner/maintainers
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canReview = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canReview) return apiError("FORBIDDEN", "Only project maintainers or owners can view applications.", null, 403);

  const applications = await prisma.application.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      role: { select: { id: true, title: true, permissionLevel: true } },
      applicant: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          skills: { include: { skill: true } },
        },
      },
    },
  });

  return apiOk({ applications });
}
