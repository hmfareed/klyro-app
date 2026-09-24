import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug/overview — project command center stats
// Spec §3 (Overview) + §40 (dashboard metrics)
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const userId = await getSessionUserId();

  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      tagline: true,
      description: true,
      status: true,
      visibility: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const membership = userId
    ? project.ownerId === userId
      ? { isOwner: true, isMember: true }
      : await prisma.teamMember
          .findUnique({
            where: { projectId_userId: { projectId: project.id, userId } },
            select: { status: true },
          })
          .then((m) => ({ isOwner: false, isMember: m?.status === "ACTIVE" }))
    : { isOwner: false, isMember: false };

  if (project.visibility !== "PUBLIC" && !membership.isMember) {
    return apiError("FORBIDDEN", "You don't have access to this private project.", null, 403);
  }

  const [tasks, milestones, members, repositories, recentActivity] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        assignees: { select: { userId: true } },
      },
    }),
    prisma.milestone.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
      select: { id: true, title: true, status: true, dueDate: true },
    }),
    prisma.teamMember.findMany({
      where: { projectId: project.id, status: "ACTIVE" },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        role: { select: { id: true, title: true, permissionLevel: true } },
      },
      take: 12,
    }),
    prisma.repository.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        name: true,
        slug: true,
        visibility: true,
        updatedAt: true,
        owner: { select: { username: true } },
        _count: { select: { pullRequests: true, issues: true } },
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.activityEvent.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    }),
  ]);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === "DONE").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const open = tasks.filter((t) => t.status !== "DONE").length;
  const overdue = tasks.filter(
    (t) => t.status !== "DONE" && t.dueDate && new Date(t.dueDate) < now,
  ).length;
  const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const completedThisWeek = tasks.filter(
    (t) => t.completedAt && new Date(t.completedAt) >= weekAgo,
  ).length;

  const doneWithDuration = tasks.filter((t) => t.completedAt);
  const avgCompletionDays =
    doneWithDuration.length > 0
      ? Math.round(
          (doneWithDuration.reduce(
            (sum, t) =>
              sum + (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()),
            0,
          ) /
            doneWithDuration.length /
            (24 * 3600 * 1000)) *
            10,
        ) / 10
      : 0;

  // Nearest upcoming due date (open milestones first, then open tasks)
  const upcomingMilestone = milestones
    .filter((m) => m.dueDate && m.status !== "DONE")
    .sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!))[0];
  const upcomingTask = tasks
    .filter((t) => t.dueDate && t.status !== "DONE")
    .sort((a, b) => +new Date(a.dueDate!) - +new Date(b.dueDate!))[0];
  const due = upcomingMilestone?.dueDate ?? upcomingTask?.dueDate ?? null;

  const byStatus = {
    TODO: tasks.filter((t) => t.status === "TODO").length,
    IN_PROGRESS: inProgress,
    IN_REVIEW: tasks.filter((t) => t.status === "IN_REVIEW").length,
    DONE: completed,
    BLOCKED: blocked,
  };

  // Workload: open tasks per member
  const workload = members.map((m) => ({
    user: m.user,
    role: m.role.title,
    openTasks: tasks.filter(
      (t) => t.status !== "DONE" && t.assignees.some((a) => a.userId === m.userId),
    ).length,
  }));

  return apiOk({
    success: true,
    data: {
      project,
      progress: { total, completed, open, percent },
      due,
      members: { total: members.length + 1, list: members, owner: project.owner },
      activeWork: inProgress,
      repositories,
      recentActivity,
      health: { open, overdue, blocked, inProgress, completedThisWeek, avgCompletionDays },
      milestones,
      byStatus,
      workload,
    },
  });
}
