import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getSessionUserId } from "@/shared/auth/session";
import { getRepoWorkflows } from "@/server/git/actions/workflow-parser";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/actions/workflows?ref=main — list discovered workflows
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  let userId: string | null = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const ref = url.searchParams.get("ref") || repository.defaultBranch || "main";

  try {
    const workflows = await getRepoWorkflows(repository.gitStoragePath, ref);
    return apiOk({ workflows, ref });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to load workflows: ${err.message}`, null, 500);
  }
}
