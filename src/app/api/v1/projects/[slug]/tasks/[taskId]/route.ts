import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { apiError, apiOk } from "@/shared/api/errors";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";

const updateTaskSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  title: z.string().min(2).max(120).optional(),
  description: z.string().max(5000).optional().nullable(),
  milestoneId: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeUserIds: z.array(z.string()).optional(),
});

// PATCH /api/v1/projects/:slug/tasks/:taskId — update task status or details
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ slug: string; taskId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug, taskId } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canEdit = await requirePermission(project.id, userId, "CONTRIBUTOR");
  if (!canEdit) return apiError("FORBIDDEN", "Only active team members can edit tasks.", null, 403);

  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: true },
  });
  if (!existingTask || existingTask.projectId !== project.id) {
    return apiError("NOT_FOUND", "Task not found.", null, 404);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", null, 400);
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "DONE" && !existingTask.completedAt) {
      updateData.completedAt = new Date();
    } else if (parsed.data.status !== "DONE") {
      updateData.completedAt = null;
    }
  }
  if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title.trim();
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description?.trim() ?? null;
  if (parsed.data.milestoneId !== undefined) updateData.milestoneId = parsed.data.milestoneId;
  if (parsed.data.dueDate !== undefined) {
    updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }

  // Handle assignees update if provided
  if (parsed.data.assigneeUserIds !== undefined) {
    await prisma.taskAssignee.deleteMany({ where: { taskId } });
    if (parsed.data.assigneeUserIds.length > 0) {
      await prisma.taskAssignee.createMany({
        data: parsed.data.assigneeUserIds.map((uid) => ({ taskId, userId: uid })),
      });
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
      milestone: { select: { id: true, title: true } },
      assignees: {
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });

  if (parsed.data.status === "DONE") {
    await recordActivityEvent({
      actorId: userId,
      projectId: project.id,
      type: ActivityEventType.TASK_COMPLETED,
      targetType: "Task",
      targetId: taskId,
      metadata: { headline: `Completed "${updatedTask.title}"`, taskTitle: updatedTask.title },
    });
  }

  return apiOk({ success: true, data: { task: updatedTask } });
}
