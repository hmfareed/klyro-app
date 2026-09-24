import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getForkSyncStatus, syncForkWithUpstream } from "@/server/git/forks/fork-sync-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/sync-fork?branch=main
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  let userId = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  if (!repository.forkedFrom) {
    return apiError("NOT_A_FORK", "This repository is not a fork", null, 400);
  }

  const branch = url.searchParams.get("branch") || repository.defaultBranch || "main";

  try {
    const syncStatus = await getForkSyncStatus(
      repository.gitStoragePath,
      repository.forkedFrom.gitStoragePath,
      branch
    );

    return apiOk({
      syncStatus,
      upstream: {
        id: repository.forkedFrom.id,
        owner: repository.forkedFrom.owner.username,
        name: repository.forkedFrom.name,
        slug: repository.forkedFrom.slug,
        defaultBranch: repository.forkedFrom.defaultBranch,
      },
    });
  } catch (err: any) {
    return apiError("SYNC_ERROR", err.message || "Failed to check fork sync status", null, 500);
  }
}

const syncForkSchema = z.object({
  branch: z.string().optional(),
  mode: z.enum(["AUTO", "FAST_FORWARD", "MERGE", "DISCARD"]).default("AUTO"),
});

// POST /api/v1/repositories/[owner]/[repo]/sync-fork
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  let userId = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;

  if (!userId) {
    const repoOwner = await prisma.repository.findFirst({
      where: { slug: repo, owner: { username: owner } },
      select: { ownerId: true },
    });
    if (repoOwner) userId = repoOwner.ownerId;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to sync fork", null, 403);

  if (!repository.forkedFrom) {
    return apiError("NOT_A_FORK", "This repository is not a fork", null, 400);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = syncForkSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const branch = parsed.data.branch || repository.defaultBranch || "main";
  const mode = parsed.data.mode;

  // Resolve author info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, username: true, email: true },
  });
  const author = {
    name: user?.displayName || user?.username || "Fork Maintainer",
    email: user?.email || "sync@klyro.dev",
  };

  try {
    const syncResult = await syncForkWithUpstream(
      repository.gitStoragePath,
      repository.forkedFrom.gitStoragePath,
      branch,
      mode,
      author
    );

    // Re-check status after sync
    const updatedStatus = await getForkSyncStatus(
      repository.gitStoragePath,
      repository.forkedFrom.gitStoragePath,
      branch
    ).catch(() => null);

    return apiOk({
      ...syncResult,
      updatedStatus,
      branch,
    });
  } catch (err: any) {
    return apiError("SYNC_FAILED", err.message || "Failed to sync fork", null, 400);
  }
}
