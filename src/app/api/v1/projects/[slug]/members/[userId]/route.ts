import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug/members/:userId — removal impact preview (spec §10)
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string; userId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const { slug, userId: targetId } = await ctx.params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canManage = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canManage) return apiError("FORBIDDEN", "Only maintainers can manage members.", null, 403);

  const [assignedTasks, openPRs, comments] = await Promise.all([
    prisma.task.count({
      where: { projectId: project.id, status: { not: "DONE" }, assignees: { some: { userId: targetId } } },
    }),
    prisma.pullRequest.count({
      where: { authorId: targetId, status: "OPEN", repository: { projectId: project.id } },
    }),
    prisma.repositoryIssueComment.count({
      where: { authorId: targetId, issue: { repository: { projectId: project.id } } },
    }),
  ]);

  return apiOk({ success: true, data: { impact: { assignedTasks, openPRs, comments } } });
}

const removeSchema = z.object({
  mode: z.enum(["unassign", "reassign"]).default("unassign"),
  reassignTo: z.string().optional(),
});

// DELETE /api/v1/projects/:slug/members/:userId — safe removal (spec §10)
export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string; userId: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const { slug, userId: targetId } = await ctx.params;

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, ownerId: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);
  if (targetId === project.ownerId) {
    return apiError("VALIDATION_ERROR", "Ownership must be transferred before removing the owner.", null, 400);
  }

  const canManage = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canManage) return apiError("FORBIDDEN", "Only maintainers can manage members.", null, 403);

  const body = await req.json().catch(() => ({}));
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid input.", null, 400);

  const member = await prisma.teamMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: targetId } },
  });
  if (!member) return apiError("NOT_FOUND", "Member not found.", null, 404);

  const affected = await prisma.task.findMany({
    where: { projectId: project.id, assignees: { some: { userId: targetId } } },
    select: { id: true },
  });

  if (parsed.data.mode === "reassign" && parsed.data.reassignTo) {
    for (const t of affected) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: t.id, userId: targetId } });
      await prisma.taskAssignee.upsert({
        where: { taskId_userId: { taskId: t.id, userId: parsed.data.reassignTo } },
        create: { taskId: t.id, userId: parsed.data.reassignTo },
        update: {},
      });
    }
  } else {
    await prisma.taskAssignee.deleteMany({
      where: { userId: targetId, task: { projectId: project.id } },
    });
  }

  await prisma.teamMember.delete({ where: { id: member.id } });

  return apiOk({ success: true, data: { removed: true, affectedTasks: affected.length } });
}
