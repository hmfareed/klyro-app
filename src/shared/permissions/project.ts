import { prisma } from "@/shared/db/prisma";
import type { PermissionLevel } from "@/generated/prisma";

// 05-projects + 12-security: per-project RBAC via TeamMember.role.permissionLevel.
// Re-check every mutating request server-side for that projectId; never infer
// from global state or trust client role display. Rank: OWNER > MAINTAINER > CONTRIBUTOR > VIEWER.
const RANK: Record<PermissionLevel, number> = {
  OWNER: 4,
  MAINTAINER: 3,
  CONTRIBUTOR: 2,
  VIEWER: 1,
};

export async function getMemberPermission(projectId: string, userId: string): Promise<PermissionLevel | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (!project) return null;
  if (project.ownerId === userId) return "OWNER";

  const member = await prisma.teamMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { role: true },
  });
  if (!member || member.status !== "ACTIVE") return null;
  return member.role.permissionLevel;
}

export async function requirePermission(
  projectId: string,
  userId: string,
  minimum: PermissionLevel,
): Promise<boolean> {
  const perm = await getMemberPermission(projectId, userId);
  if (!perm) return false;
  return RANK[perm] >= RANK[minimum];
}
