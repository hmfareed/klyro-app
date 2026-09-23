import { prisma } from "@/shared/db/prisma";
import { verifyRecordHash, RecordPayload } from "@/shared/records/hasher";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/records/:recordHash — public cryptographic verification endpoint
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ recordHash: string }> },
) {
  const { recordHash } = await ctx.params;

  const record = await prisma.contributionRecord.findUnique({
    where: { recordHash },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true },
      },
      project: {
        select: {
          id: true,
          slug: true,
          title: true,
          tagline: true,
          ipModel: true,
          openSourceLicense: true,
          createdAt: true,
          owner: { select: { username: true, displayName: true } },
        },
      },
      milestone: {
        select: { id: true, title: true, dueDate: true },
      },
    },
  });

  if (!record) {
    return apiError("NOT_FOUND", "No contribution record found matching this cryptographic hash.", null, 404);
  }

  const attestations = (Array.isArray(record.peerAttestations)
    ? record.peerAttestations
    : []) as Array<{ fromUserId: string; fromName: string; statement: string; rating: number }>;

  const payload: RecordPayload = {
    userId: record.userId,
    projectId: record.projectId,
    milestoneId: record.milestoneId,
    roleTitle: record.roleTitle,
    tasksCompleted: record.tasksCompleted,
    commitsAuthored: record.commitsAuthored,
    peerAttestations: attestations,
    issuedAt: record.issuedAt.toISOString(),
  };

  const isHashValid = verifyRecordHash(payload, record.recordHash);

  return apiOk({
    record,
    verification: {
      isHashValid,
      isFinal: record.isFinal,
      algorithm: "SHA-256",
      verifiedAt: new Date().toISOString(),
    },
  });
}
