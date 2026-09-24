import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
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
      success: true,
      data: {
        project,
        viewer: {
          isOwner,
          isMember,
          userApplication,
        },
      },
    });
  } catch (err) {
    return apiError("INTERNAL_ERROR", "Failed to retrieve project details.", err instanceof Error ? err.message : null, 500);
  }
}

const patchSchema = z.object({
  title: z.string().min(2).max(80).optional(),
  tagline: z.string().max(160).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(60).optional(),
  status: z.enum(["RECRUITING", "IN_PROGRESS", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
});

// PATCH /api/v1/projects/:slug — update project settings (owner/maintainer)
export async function PATCH(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canManage = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canManage) return apiError("FORBIDDEN", "Only maintainers can update settings.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", null, 400);
  }

  const updated = await prisma.project.update({
    where: { id: project.id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.tagline !== undefined ? { tagline: parsed.data.tagline.trim() } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
      ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.visibility !== undefined ? { visibility: parsed.data.visibility } : {}),
    },
    select: { id: true, slug: true, title: true, tagline: true, status: true, visibility: true },
  });

  await recordActivityEvent({
    actorId: userId,
    projectId: project.id,
    type: ActivityEventType.PROJECT_UPDATED,
    metadata: { headline: "Project settings updated" },
  });

  return apiOk({ success: true, data: { project: updated } });
}
