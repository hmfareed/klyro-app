import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { requirePermission } from "@/shared/permissions/project";

const updateSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(5).max(5000),
});

// GET /api/v1/projects/:slug/updates — list project updates
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const updates = await prisma.projectUpdate.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  return apiOk({ updates });
}

// POST /api/v1/projects/:slug/updates — post a project update
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, visibility: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canPost = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canPost) return apiError("FORBIDDEN", "Only project maintainers or owners can post updates.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }

  const update = await prisma.projectUpdate.create({
    data: {
      projectId: project.id,
      authorId: userId,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
    },
  });

  // Emit POST_UPDATE activity event
  await recordActivityEvent({
    actorId: userId,
    projectId: project.id,
    type: ActivityEventType.POST_UPDATE,
    targetType: "ProjectUpdate",
    targetId: update.id,
    visibility: project.visibility,
    metadata: {
      title: update.title,
      body: update.body,
    },
  });

  return apiOk({ update }, 201);
}
