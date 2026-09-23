import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { buildCommitGraph } from "@/server/git/graph/commit-graph-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/network?ref=all&limit=100&skip=0
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const ref = url.searchParams.get("ref") || "all";
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);
  const skip = parseInt(url.searchParams.get("skip") || "0", 10);

  try {
    const graph = await buildCommitGraph(repository.gitStoragePath, {
      ref,
      limit,
      skip,
    });

    return apiOk({
      ref,
      ...graph,
      defaultBranch: repository.defaultBranch,
    });
  } catch (err: any) {
    return apiError("GIT_ERROR", err.message || "Failed to generate commit graph", null, 500);
  }
}
