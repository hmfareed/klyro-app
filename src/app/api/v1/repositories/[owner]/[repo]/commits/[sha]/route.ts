import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getCommitDiff } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string; sha: string }> };

// GET /api/v1/repositories/[owner]/[repo]/commits/[sha]
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, sha } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  try {
    const diff = await getCommitDiff(repository.gitStoragePath, sha);
    return apiOk(diff);
  } catch (err: any) {
    return apiError("NOT_FOUND", `Commit not found: ${sha}`, null, 404);
  }
}
