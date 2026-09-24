import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";

export interface RepoAccessResult {
  repository: any;
  viewer: {
    isAuthenticated: boolean;
    userId: string | null;
    isOwner: boolean;
    canRead: boolean;
    canWrite: boolean;
    canAdmin: boolean;
    isStarred: boolean;
    isWatching: boolean;
    role: string | null;
  };
}

/**
 * Resolves repository by owner username + repo slug (or by repoId/slug)
 * and evaluates viewer permissions.
 */
export async function getRepositoryWithAccess(
  ownerUsernameOrId: string,
  repoSlug?: string,
  explicitUserId?: string | null
): Promise<RepoAccessResult | null> {
  const userId = explicitUserId !== undefined ? explicitUserId : await getSessionUserId();

  let repository;

  if (repoSlug) {
    // Lookup by owner.username + repository.slug
    repository = await prisma.repository.findFirst({
      where: {
        slug: repoSlug,
        owner: {
          username: { equals: ownerUsernameOrId, mode: "insensitive" },
        },
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, slug: true, visibility: true },
        },
        forkedFrom: {
          select: {
            id: true,
            name: true,
            slug: true,
            gitStoragePath: true,
            defaultBranch: true,
            owner: { select: { username: true } },
          },
        },
        branchRules: true,
        _count: {
          select: {
            stars: true,
            watchers: true,
            issues: { where: { status: "OPEN" } },
            pullRequests: { where: { status: "OPEN" } },
            releases: true,
            forks: true,
          },
        },
      },
    });
  } else {
    // Lookup by ID or direct slug
    repository = await prisma.repository.findFirst({
      where: {
        OR: [{ id: ownerUsernameOrId }, { slug: ownerUsernameOrId }],
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        project: {
          select: { id: true, title: true, slug: true, visibility: true },
        },
        forkedFrom: {
          select: {
            id: true,
            name: true,
            slug: true,
            gitStoragePath: true,
            defaultBranch: true,
            owner: { select: { username: true } },
          },
        },
        branchRules: true,
        _count: {
          select: {
            stars: true,
            watchers: true,
            issues: { where: { status: "OPEN" } },
            pullRequests: { where: { status: "OPEN" } },
            releases: true,
            forks: true,
          },
        },
      },
    });
  }

  if (!repository) return null;

  const isOwner = Boolean(userId && repository.ownerId === userId);

  // Check collaborator role
  let collabRole: string | null = null;
  if (userId && !isOwner) {
    const collab = await prisma.repositoryCollaborator.findUnique({
      where: {
        repositoryId_userId: {
          repositoryId: repository.id,
          userId,
        },
      },
    });
    if (collab) collabRole = collab.role;
  }

  const isDeleted = repository.status === "DELETED" || repository.status === "PURGING";
  if (isDeleted) return null;

  const isDeletionPending = repository.status === "DELETION_PENDING";
  const canAdmin = isOwner || collabRole === "OWNER" || collabRole === "MAINTAINER";

  // If repository is pending deletion, hide it from unauthorized / non-admin viewers (404)
  if (isDeletionPending && !canAdmin) {
    return null;
  }

  // Permission logic
  const isPublic = repository.visibility === "PUBLIC";
  const canRead = isOwner || Boolean(collabRole) || (isPublic && !isDeletionPending);
  const canWrite =
    !isDeletionPending &&
    !repository.archived &&
    (isOwner ||
      collabRole === "OWNER" ||
      collabRole === "MAINTAINER" ||
      collabRole === "CONTRIBUTOR");

  // Check star & watch
  let isStarred = false;
  let isWatching = false;
  if (userId) {
    const star = await prisma.repositoryStar.findUnique({
      where: {
        userId_repositoryId: {
          userId,
          repositoryId: repository.id,
        },
      },
    });
    isStarred = Boolean(star);

    const watcher = await prisma.repositoryWatcher.findUnique({
      where: {
        userId_repositoryId: {
          userId,
          repositoryId: repository.id,
        },
      },
    });
    isWatching = Boolean(watcher && watcher.level !== "IGNORE");
  }

  return {
    repository,
    viewer: {
      isAuthenticated: Boolean(userId),
      userId,
      isOwner,
      canRead,
      canWrite,
      canAdmin,
      isStarred,
      isWatching,
      role: isOwner ? "OWNER" : collabRole,
    },
  };
}
