import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { searchFiles } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/files-search?ref=main&q=test
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";
  const query = url.searchParams.get("q") || "";

  try {
    const files = await searchFiles(repository.gitStoragePath, ref, query);
    return apiOk({ files });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to search files", null, 500);
  }
}
