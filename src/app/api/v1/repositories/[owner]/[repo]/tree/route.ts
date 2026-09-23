import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getTree } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/tree?ref=main&path=src
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "";

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";

  try {
    const { entries, latestCommit } = await getTree(repository.gitStoragePath, ref, path);

    // Also check if README.md exists in this directory (or root) to return its content
    return apiOk({
      ref,
      path,
      entries,
      latestCommit,
    });
  } catch (err: any) {
    return apiError("GIT_ERROR", err.message || "Failed to load directory tree", null, 400);
  }
}
