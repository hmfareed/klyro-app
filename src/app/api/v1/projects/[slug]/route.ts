import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug — full project detail
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  const { slug } = await ctx.params;

  try {
    const project = await prisma.project.findUnique({
      where: { slug },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true },
        },
        roles: {
          orderBy: { isOpen: "desc" },
          include: {
            members: {
              where: { status: "ACTIVE" },
              include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              },
            },
          },
        },
        members: {
          where: { status: "ACTIVE" },
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            role: { select: { id: true, title: true, permissionLevel: true } },
          },
        },
        milestones: {
          orderBy: { order: "asc" },
          select: { id: true, title: true, status: true, dueDate: true },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
            threads: true,
            files: true,
            applications: true,
            contributionRecords: true,
          },
        },
      },
    });

    if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

    const isOwner = userId ? project.ownerId === userId : false;
    const isMember = isOwner || (userId ? project.members.some((m) => m.userId === userId) : false);

    if (project.visibility !== "PUBLIC" && !isMember) {
      return apiError("FORBIDDEN", "You don't have access to this private project.", null, 403);
    }

    // Check if the user has an existing application
    let userApplication = null;
    if (userId && !isMember) {
      userApplication = await prisma.application.findFirst({
        where: { projectId: project.id, applicantId: userId },
        select: { id: true, roleId: true, status: true, createdAt: true },
      });
    }

    return apiOk({
      project,
      viewer: {
        isOwner,
        isMember,
        userApplication,
      },
    });
  } catch (err) {
    return apiError("INTERNAL_ERROR", "Failed to retrieve project details.", err instanceof Error ? err.message : null, 500);
  }
}
