import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug/activity — immutable activity stream (spec §36)
const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const userId = await getSessionUserId();

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, ownerId: true, visibility: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const isMember = userId
    ? project.ownerId === userId ||
      (await prisma.teamMember
        .findUnique({
          where: { projectId_userId: { projectId: project.id, userId } },
          select: { status: true },
        })
        .then((m) => m?.status === "ACTIVE"))
    : false;

  if (project.visibility !== "PUBLIC" && !isMember) {
    return apiError("FORBIDDEN", "You don't have access to this private project.", null, 403);
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  const limit = parsed.success ? parsed.data.limit : 30;
  const cursor = parsed.success ? parsed.data.cursor : undefined;

  const events = await prisma.activityEvent.findMany({
    where: {
      projectId: project.id,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  const hasMore = events.length > limit;
  const page = hasMore ? events.slice(0, limit) : events;
  const nextCursor = hasMore ? page[page.length - 1].createdAt.toISOString() : null;

  return apiOk({ success: true, data: { events: page, nextCursor, hasMore } });
}
