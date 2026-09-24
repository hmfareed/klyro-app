import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { createNotification } from "@/shared/notifications/create";
import { apiError, apiOk } from "@/shared/api/errors";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";

const createTaskSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(5000).optional(),
  milestoneId: z.string().optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"]).default("TODO"),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeUserIds: z.array(z.string()).optional(),
});

// GET /api/v1/projects/:slug/tasks — list project tasks (with filters: status, priority, q, assignee, overdue, milestoneId)
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const userId = await getSessionUserId();
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const url = new URL(req.url);
  const milestoneId = url.searchParams.get("milestoneId");
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const q = url.searchParams.get("q")?.trim();
  const assignee = url.searchParams.get("assignee"); // "me" | userId | "unassigned"
  const overdueOnly = url.searchParams.get("overdue") === "1";

  const whereClause: Record<string, unknown> = { projectId: project.id };
  if (milestoneId) whereClause.milestoneId = milestoneId;
  if (status && ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"].includes(status)) {
    whereClause.status = status;
  }
  if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
    whereClause.priority = priority;
  }
  if (q) {
    whereClause.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (assignee === "me" && userId) {
    whereClause.assignees = { some: { userId } };
  } else if (assignee === "unassigned") {
    whereClause.assignees = { none: {} };
  } else if (assignee) {
    whereClause.assignees = { some: { userId: assignee } };
  }
  if (overdueOnly) {
    whereClause.status = { not: "DONE" };
    whereClause.dueDate = { lt: new Date() };
  }

  const tasks = await prisma.task.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    include: {
      milestone: { select: { id: true, title: true } },
      assignees: {
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });

  return apiOk({ success: true, data: { tasks } });
}

// POST /api/v1/projects/:slug/tasks — create a task
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canCreate = await requirePermission(project.id, userId, "CONTRIBUTOR");
  if (!canCreate) return apiError("FORBIDDEN", "Only active team members can create tasks.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }

  const task = await prisma.task.create({
    data: {
      projectId: project.id,
      title: parsed.data.title.trim(),
      description: parsed.data.description?.trim() ?? null,
      milestoneId: parsed.data.milestoneId ?? null,
      priority: parsed.data.priority,
      status: parsed.data.status,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assignees: parsed.data.assigneeUserIds && parsed.data.assigneeUserIds.length > 0
        ? {
            create: parsed.data.assigneeUserIds.map((uid) => ({
              userId: uid,
            })),
          }
        : undefined,
    },
    include: {
      milestone: { select: { id: true, title: true } },
      assignees: {
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });

  // Notify any assigned users
  if (parsed.data.assigneeUserIds) {
    for (const assigneeId of parsed.data.assigneeUserIds) {
      if (assigneeId !== userId) {
        await createNotification({
          userId: assigneeId,
          type: "TASK_ASSIGNED",
          title: `Assigned: ${task.title}`,
          body: `You were assigned to a new task in ${project.title}.`,
          linkUrl: `/projects/${project.slug}/workspace?tab=tasks`,
        });
      }
    }
  }

  await recordActivityEvent({
    actorId: userId,
    projectId: project.id,
    type: ActivityEventType.TASK_CREATED,
    targetType: "Task",
    targetId: task.id,
    metadata: { headline: `Created task "${task.title}"`, taskTitle: task.title },
  });

  return apiOk({ success: true, data: { task } }, 201);
}
