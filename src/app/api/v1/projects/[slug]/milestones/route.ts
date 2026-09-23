import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { apiError, apiOk } from "@/shared/api/errors";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";

const createMilestoneSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().max(3000).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  order: z.number().int().default(0),
});

// GET /api/v1/projects/:slug/milestones — list project milestones with task counts
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const milestones = await prisma.milestone.findMany({
    where: { projectId: project.id },
    orderBy: { order: "asc" },
    include: {
      tasks: {
        select: { id: true, status: true },
      },
      _count: { select: { tasks: true, contributionRecords: true } },
    },
  });

  const formatted = milestones.map((m) => {
    const total = m.tasks.length;
    const done = m.tasks.filter((t) => t.status === "DONE").length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return {
      id: m.id,
      title: m.title,
      description: m.description,
      status: m.status,
      dueDate: m.dueDate,
      order: m.order,
      createdAt: m.createdAt,
      totalTasks: total,
      doneTasks: done,
      progress,
    };
  });

  return apiOk({ milestones: formatted });
}

// POST /api/v1/projects/:slug/milestones — create a new milestone
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canManage = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canManage) return apiError("FORBIDDEN", "Only project maintainers or owners can create milestones.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createMilestoneSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }

  const milestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ?? null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      order: parsed.data.order,
    },
  });

  await recordActivityEvent({
    actorId: userId,
    projectId: project.id,
    type: ActivityEventType.MILESTONE_CREATED,
    targetType: "Milestone",
    targetId: milestone.id,
    metadata: {
      milestoneTitle: milestone.title,
      description: milestone.description,
    },
  });

  return apiOk({ milestone }, 201);
}
