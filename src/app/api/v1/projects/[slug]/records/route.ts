import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { generateRecordHash, RecordPayload } from "@/shared/records/hasher";
import { createNotification } from "@/shared/notifications/create";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug/records — list contribution records for this project
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const records = await prisma.contributionRecord.findMany({
    where: { projectId: project.id },
    orderBy: { issuedAt: "desc" },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      milestone: { select: { id: true, title: true } },
    },
  });

  return apiOk({ records });
}

const generateSchema = z.object({
  contributorUserId: z.string().min(1),
  milestoneId: z.string().optional().nullable(),
  summary: z.string().min(10).max(5000),
  commitsAuthored: z.number().int().min(0).default(0),
});

// POST /api/v1/projects/:slug/records — generate a verified contribution record
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true, slug: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canIssue = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canIssue) return apiError("FORBIDDEN", "Only project maintainers or owners can issue contribution records.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = generateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", null, 400);
  }

  const { contributorUserId, milestoneId, summary, commitsAuthored } = parsed.data;

  // Resolve contributor's role title in the project
  const member = await prisma.teamMember.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: contributorUserId } },
    include: { role: true },
  });
  const roleTitle = member?.role.title ?? "Contributor";

  // Calculate system-observed completed tasks for this user
  const tasksCompleted = await prisma.task.count({
    where: {
      projectId: project.id,
      status: "DONE",
      assignees: { some: { userId: contributorUserId } },
      ...(milestoneId ? { milestoneId } : {}),
    },
  });

  const now = new Date();
  const payload: RecordPayload = {
    userId: contributorUserId,
    projectId: project.id,
    milestoneId: milestoneId ?? null,
    roleTitle,
    tasksCompleted,
    commitsAuthored,
    peerAttestations: [],
    issuedAt: now.toISOString(),
  };

  const recordHash = generateRecordHash(payload);

  const record = await prisma.contributionRecord.create({
    data: {
      userId: contributorUserId,
      projectId: project.id,
      milestoneId: milestoneId ?? null,
      roleTitle,
      summary: summary.trim(),
      tasksCompleted,
      commitsAuthored,
      peerAttestations: [],
      issuedAt: now,
      recordHash,
      isFinal: false,
    },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  await createNotification({
    userId: contributorUserId,
    type: "RECORD_ISSUED",
    title: `Contribution record drafted in ${project.title}`,
    body: `A contribution record for your work as ${roleTitle} was generated.`,
    linkUrl: `/records/${record.recordHash}`,
  });

  return apiOk({ record }, 201);
}
