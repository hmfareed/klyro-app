import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { evaluateMergeGates } from "@/server/git/policy/merge-gates";
import { getSessionUserId } from "@/shared/auth/session";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

// GET /api/v1/repositories/[owner]/[repo]/pulls/[number]/gates — evaluate merge requirements
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);
  if (isNaN(prNumber)) return apiError("INVALID_NUMBER", "Invalid pull request number", null, 400);

  let userId: string | null = null;
  try {
    userId = await getSessionUserId();
  } catch {
    // CLI tests or outside request context
  }

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
    select: {
      id: true,
      number: true,
      baseBranch: true,
      headBranch: true,
      authorId: true,
      status: true,
    },
  });

  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  try {
    const evaluation = await evaluateMergeGates({
      repositoryId: repository.id,
      gitStoragePath: repository.gitStoragePath,
      pullRequest,
    });

    return apiOk(evaluation);
  } catch (err: any) {
    return apiError("GATE_EVALUATION_ERROR", err.message || "Failed to evaluate merge gates", null, 500);
  }
}
