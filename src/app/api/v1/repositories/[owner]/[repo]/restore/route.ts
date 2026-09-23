import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { restoreRepository } from "@/server/repositories/repo-lifecycle";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// POST /api/v1/repositories/[owner]/[repo]/restore — restore repository from deletion pending
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin || !viewer.userId) {
    return apiError("FORBIDDEN", "Admin permissions required to restore repository", null, 403);
  }

  const outcome = await restoreRepository({
    repository,
    actorId: viewer.userId,
    req,
  });

  if (!outcome.success) {
    return apiError("BAD_REQUEST", outcome.message || "Failed to restore repository", null, 400);
  }

  return apiOk({ repository: outcome.repository });
}
