import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { apiError, apiOk } from "@/shared/api/errors";

const createThreadSchema = z.object({
  title: z.string().min(3).max(120),
  body: z.string().min(5).max(10000),
});

// GET /api/v1/projects/:slug/discussions — list discussion threads
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, visibility: true, ownerId: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const threads = await prisma.discussionThread.findMany({
    where: { projectId: project.id },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      _count: { select: { comments: true } },
    },
  });

  return apiOk({ threads });
}

// POST /api/v1/projects/:slug/discussions — start a new discussion thread
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canParticipate = await requirePermission(project.id, userId, "CONTRIBUTOR");
  if (!canParticipate) {
    return apiError("FORBIDDEN", "Only active team members can start discussions.", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }

  const thread = await prisma.discussionThread.create({
    data: {
      projectId: project.id,
      authorId: userId,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  return apiOk({ thread }, 201);
}
