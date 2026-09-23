import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getBlame } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/blame?ref=main&path=README.md
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);
  const filePath = url.searchParams.get("path");

  if (!filePath) {
    return apiError("MISSING_PATH", "Query param 'path' is required", "path", 400);
  }

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";

  try {
    const lines = await getBlame(repository.gitStoragePath, ref, filePath);
    return apiOk({ ref, path: filePath, lines });
  } catch (err: any) {
    return apiError("GIT_ERROR", err.message || "Failed to load blame", null, 500);
  }
}
