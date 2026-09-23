import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { requirePermission } from "@/shared/permissions/project";

const releaseSchema = z.object({
  version: z.string().min(1).max(30),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional(),
  releaseNotes: z.string().max(10000).optional(),
});

// GET /api/v1/projects/:slug/releases — list project releases
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const releases = await prisma.release.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  return apiOk({ releases });
}

// POST /api/v1/projects/:slug/releases — publish a new release
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, visibility: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canRelease = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canRelease) return apiError("FORBIDDEN", "Only project maintainers or owners can create releases.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = releaseSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }

  // Find previous release if any for version comparison
  const previous = await prisma.release.findFirst({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: { version: true },
  });

  const release = await prisma.release.create({
    data: {
      projectId: project.id,
      createdById: userId,
      version: parsed.data.version.trim(),
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ?? null,
      releaseNotes: parsed.data.releaseNotes?.trim() ?? null,
    },
  });

  // Emit RELEASE_CREATED activity event
  await recordActivityEvent({
    actorId: userId,
    projectId: project.id,
    type: ActivityEventType.RELEASE_CREATED,
    targetType: "Release",
    targetId: release.id,
    visibility: project.visibility,
    metadata: {
      version: release.version,
      versionFrom: previous?.version,
      title: release.title,
      description: release.description,
    },
  });

  return apiOk({ release }, 201);
}
