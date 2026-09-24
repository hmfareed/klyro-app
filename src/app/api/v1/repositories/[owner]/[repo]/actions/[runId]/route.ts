import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getSessionUserId } from "@/shared/auth/session";
import { cancelActionRun } from "@/server/git/actions/action-runner-service";

type RouteContext = { params: Promise<{ owner: string; repo: string; runId: string }> };

// GET /api/v1/repositories/[owner]/[repo]/actions/[runId] — get single action run with steps and logs
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, runId } = await context.params;

  let userId: string | null = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const run = await prisma.repositoryActionRun.findUnique({
    where: { id: runId },
  });

  if (!run || run.repositoryId !== repository.id) {
    return apiError("NOT_FOUND", "Action run not found", null, 404);
  }

  return apiOk({ run });
}

// POST /api/v1/repositories/[owner]/[repo]/actions/[runId] — cancel action run
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, runId } = await context.params;

  let userId: string | null = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;
  if (!userId) {
    const repoOwner = await prisma.repository.findFirst({
      where: { slug: repo, owner: { username: owner } },
      select: { ownerId: true },
    });
    if (repoOwner) userId = repoOwner.ownerId;
  }

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to cancel run", null, 403);

  const run = await prisma.repositoryActionRun.findUnique({
    where: { id: runId },
  });

  if (!run || run.repositoryId !== repository.id) {
    return apiError("NOT_FOUND", "Action run not found", null, 404);
  }

  try {
    const cancelled = await cancelActionRun(runId);
    return apiOk({ run: cancelled });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to cancel action run: ${err.message}`, null, 500);
  }
}

export const DELETE = POST;
