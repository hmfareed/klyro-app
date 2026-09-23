import fs from "node:fs/promises";
import { prisma } from "@/shared/db/prisma";
import { recordRepoAuditEvent } from "./repo-audit";
import { scanRepoForSecrets, SecretFinding } from "./secret-scanner";
import { Visibility } from "@/generated/prisma";

export interface ChangeVisibilityParams {
  repository: any;
  actorId: string;
  newVisibility: "PUBLIC" | "PRIVATE";
  forceWithWarnings?: boolean;
  req?: Request;
}

export async function changeRepositoryVisibility({
  repository,
  actorId,
  newVisibility,
  forceWithWarnings = false,
  req,
}: ChangeVisibilityParams): Promise<
  | { success: true; repository: any }
  | { success: false; code: "SECRETS_DETECTED"; findings: SecretFinding[] }
  | { success: false; code: string; message: string }
> {
  if (repository.visibility === newVisibility) {
    return { success: true, repository };
  }

  // Pre-flight secret scan if switching from PRIVATE to PUBLIC
  if (newVisibility === "PUBLIC") {
    const scanResult = await scanRepoForSecrets(
      repository.gitStoragePath,
      repository.defaultBranch || "main"
    );

    if (scanResult.hasWarnings && !forceWithWarnings) {
      return {
        success: false,
        code: "SECRETS_DETECTED",
        findings: scanResult.findings,
      };
    }
  }

  const updated = await prisma.repository.update({
    where: { id: repository.id },
    data: { visibility: newVisibility as Visibility },
    include: {
      owner: { select: { id: true, username: true } },
    },
  });

  await recordRepoAuditEvent({
    repositoryId: repository.id,
    actorId,
    action: "REPOSITORY_VISIBILITY_CHANGED",
    previousValue: repository.visibility,
    newValue: newVisibility,
    metadata: {
      warningsOverridden: Boolean(forceWithWarnings),
    },
    req,
  });

  return { success: true, repository: updated };
}

export interface SetArchiveStateParams {
  repository: any;
  actorId: string;
  archived: boolean;
  req?: Request;
}

export async function setRepositoryArchiveState({
  repository,
  actorId,
  archived,
  req,
}: SetArchiveStateParams) {
  const updated = await prisma.repository.update({
    where: { id: repository.id },
    data: {
      archived,
      archivedAt: archived ? new Date() : null,
      status: archived ? "ARCHIVED" : "ACTIVE",
    },
    include: {
      owner: { select: { id: true, username: true } },
    },
  });

  await recordRepoAuditEvent({
    repositoryId: repository.id,
    actorId,
    action: archived ? "REPOSITORY_ARCHIVED" : "REPOSITORY_UNARCHIVED",
    previousValue: repository.archived ? "ARCHIVED" : "ACTIVE",
    newValue: archived ? "ARCHIVED" : "ACTIVE",
    req,
  });

  return { success: true, repository: updated };
}

export interface ScheduleDeletionParams {
  repository: any;
  actorId: string;
  confirmationName: string;
  cancelActiveWorkflows?: boolean;
  retentionDays?: number;
  req?: Request;
}

export async function scheduleRepositoryDeletion({
  repository,
  actorId,
  confirmationName,
  cancelActiveWorkflows = true,
  retentionDays = 30,
  req,
}: ScheduleDeletionParams): Promise<
  | { success: true; repository: any; purgeAt: Date; daysRemaining: number }
  | { success: false; message: string }
> {
  const expectedName = repository.name.trim().toLowerCase();
  const givenName = confirmationName.trim().toLowerCase();
  const expectedFullSlug = `${repository.owner?.username || ""}/${repository.name}`.toLowerCase();

  if (givenName !== expectedName && givenName !== expectedFullSlug && givenName !== repository.slug.toLowerCase()) {
    return {
      success: false,
      message: `Confirmation mismatch. Please type '${repository.name}' exactly.`,
    };
  }

  // Cancel any active workflow runs if requested
  if (cancelActiveWorkflows) {
    await prisma.repositoryActionRun.updateMany({
      where: {
        repositoryId: repository.id,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
      },
    });
  }

  const now = new Date();
  const purgeAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

  const updated = await prisma.repository.update({
    where: { id: repository.id },
    data: {
      status: "DELETION_PENDING",
      deletedAt: now,
      deletionScheduledAt: now,
      purgeAt,
    },
    include: {
      owner: { select: { id: true, username: true } },
    },
  });

  await recordRepoAuditEvent({
    repositoryId: repository.id,
    actorId,
    action: "REPOSITORY_DELETION_SCHEDULED",
    previousValue: repository.status,
    newValue: "DELETION_PENDING",
    metadata: {
      retentionDays,
      purgeAt: purgeAt.toISOString(),
      cancelledWorkflows: cancelActiveWorkflows,
    },
    req,
  });

  return {
    success: true,
    repository: updated,
    purgeAt,
    daysRemaining: retentionDays,
  };
}

export interface RestoreRepositoryParams {
  repository: any;
  actorId: string;
  req?: Request;
}

export async function restoreRepository({
  repository,
  actorId,
  req,
}: RestoreRepositoryParams): Promise<{ success: boolean; repository?: any; message?: string }> {
  if (repository.status !== "DELETION_PENDING") {
    return {
      success: false,
      message: "This repository is not scheduled for deletion.",
    };
  }

  const now = new Date();
  const nextStatus = repository.archived ? "ARCHIVED" : "ACTIVE";

  const updated = await prisma.repository.update({
    where: { id: repository.id },
    data: {
      status: nextStatus,
      deletedAt: null,
      deletionScheduledAt: null,
      purgeAt: null,
      restoredAt: now,
    },
    include: {
      owner: { select: { id: true, username: true } },
    },
  });

  await recordRepoAuditEvent({
    repositoryId: repository.id,
    actorId,
    action: "REPOSITORY_RESTORED",
    previousValue: "DELETION_PENDING",
    newValue: nextStatus,
    metadata: {
      restoredAt: now.toISOString(),
    },
    req,
  });

  return { success: true, repository: updated };
}

export interface PurgeRepositoryParams {
  repository: any;
  actorId: string;
  req?: Request;
}

export async function purgeRepositoryPermanently({
  repository,
  actorId,
  req,
}: PurgeRepositoryParams) {
  // 1. Fork independence: reparent any child forks to grandparent or detach cleanly
  await prisma.repository.updateMany({
    where: { forkedFromId: repository.id },
    data: { forkedFromId: repository.forkedFromId || null },
  });

  // 2. Remove physical bare Git directory on disk
  if (repository.gitStoragePath) {
    await fs.rm(repository.gitStoragePath, { recursive: true, force: true }).catch((err) => {
      console.warn(`[RepoLifecycle] Error removing git storage path ${repository.gitStoragePath}:`, err);
    });
  }

  // 3. Delete database record (cascades associated rows)
  await prisma.repository.delete({
    where: { id: repository.id },
  });

  return { success: true };
}
