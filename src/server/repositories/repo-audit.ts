import { prisma } from "@/shared/db/prisma";

export type RepoAuditAction =
  | "REPOSITORY_VISIBILITY_CHANGED"
  | "REPOSITORY_ARCHIVED"
  | "REPOSITORY_UNARCHIVED"
  | "REPOSITORY_DELETION_SCHEDULED"
  | "REPOSITORY_RESTORED"
  | "REPOSITORY_PURGED";

export interface RecordRepoAuditParams {
  repositoryId: string;
  actorId: string;
  action: RepoAuditAction | string;
  previousValue?: string | null;
  newValue?: string | null;
  metadata?: Record<string, any> | null;
  req?: Request;
}

/**
 * Records an append-only audit event for repository lifecycle operations.
 * Extracts IP address and User-Agent if a Request object is provided.
 */
export async function recordRepoAuditEvent(params: RecordRepoAuditParams) {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  if (params.req) {
    ipAddress =
      params.req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      params.req.headers.get("x-real-ip") ||
      null;
    userAgent = params.req.headers.get("user-agent") || null;
  }

  try {
    return await prisma.repositoryAuditEvent.create({
      data: {
        repositoryId: params.repositoryId,
        actorId: params.actorId,
        action: params.action,
        previousValue: params.previousValue,
        newValue: params.newValue,
        metadata: params.metadata || undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error("[RepoAudit] Failed to record audit event:", err);
    return null;
  }
}
