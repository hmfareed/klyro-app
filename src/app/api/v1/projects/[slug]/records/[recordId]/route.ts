import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { generateRecordHash, RecordPayload } from "@/shared/records/hasher";
import { createNotification } from "@/shared/notifications/create";
import { apiError, apiOk } from "@/shared/api/errors";

const attestSchema = z.object({
  statement: z.string().min(10).max(1000),
  rating: z.number().int().min(1).max(5).default(5),
});

// POST /api/v1/projects/:slug/records/:recordId/attest — add a peer attestation
export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string; recordId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug, recordId } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const record = await prisma.contributionRecord.findUnique({
    where: { id: recordId },
  });
  if (!record || record.projectId !== project.id) {
    return apiError("NOT_FOUND", "Record not found.", null, 404);
  }
  if (record.isFinal) {
    return apiError("RECORD_FROZEN", "This record is final and immutable.", null, 400);
  }
  if (record.userId === userId) {
    return apiError("CANNOT_SELF_ATTEST", "You cannot attest to your own contribution record.", null, 400);
  }

  // Verify caller is a team member
  const canAttest = await requirePermission(project.id, userId, "CONTRIBUTOR");
  if (!canAttest) return apiError("FORBIDDEN", "Only active team members can provide attestations.", null, 403);

  const reviewer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true, username: true },
  });

  const body = await req.json().catch(() => null);
  const parsed = attestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", null, 400);
  }

  const existingAttestations = (Array.isArray(record.peerAttestations)
    ? record.peerAttestations
    : []) as Array<{ fromUserId: string; fromName: string; statement: string; rating: number }>;

  const updatedAttestations = [
    ...existingAttestations.filter((a) => a.fromUserId !== userId),
    {
      fromUserId: userId,
      fromName: reviewer?.displayName || reviewer?.username || "Teammate",
      statement: parsed.data.statement.trim(),
      rating: parsed.data.rating,
    },
  ];

  // Recompute hash
  const payload: RecordPayload = {
    userId: record.userId,
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    roleTitle: record.roleTitle,
    tasksCompleted: record.tasksCompleted,
    commitsAuthored: record.commitsAuthored,
    peerAttestations: updatedAttestations,
    issuedAt: record.issuedAt.toISOString(),
  };
  const newHash = generateRecordHash(payload);

  const updatedRecord = await prisma.contributionRecord.update({
    where: { id: recordId },
    data: {
      peerAttestations: updatedAttestations,
      recordHash: newHash,
    },
  });

  return apiOk({ record: updatedRecord });
}

// PATCH /api/v1/projects/:slug/records/:recordId — finalize and freeze record
export async function PATCH(
  _req: Request,
  ctx: { params: Promise<{ slug: string; recordId: string }> },
) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug, recordId } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, title: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canFinalize = await requirePermission(project.id, userId, "MAINTAINER");
  if (!canFinalize) return apiError("FORBIDDEN", "Only project maintainers or owners can finalize records.", null, 403);

  const record = await prisma.contributionRecord.findUnique({
    where: { id: recordId },
  });
  if (!record || record.projectId !== project.id) {
    return apiError("NOT_FOUND", "Record not found.", null, 404);
  }

  const updated = await prisma.contributionRecord.update({
    where: { id: recordId },
    data: { isFinal: true },
  });

  await createNotification({
    userId: record.userId,
    type: "RECORD_ISSUED",
    title: `Verified Contribution Record Certified!`,
    body: `Your contribution record for ${project.title} has been finalized and cryptographically verified.`,
    linkUrl: `/records/${updated.recordHash}`,
  });

  return apiOk({ record: updated, message: "Record permanently sealed and verified." });
}
