import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getCommits } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/commits?ref=main&path=&limit=30&skip=0
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";
  const path = url.searchParams.get("path") || undefined;
  const limit = parseInt(url.searchParams.get("limit") || "30", 10);
  const skip = parseInt(url.searchParams.get("skip") || "0", 10);

  try {
    const commits = await getCommits(repository.gitStoragePath, ref, { path, limit, skip });
    return apiOk({ ref, path, commits });
  } catch (err: any) {
    return apiError("GIT_ERROR", err.message || "Failed to load commits", null, 500);
  }
}
