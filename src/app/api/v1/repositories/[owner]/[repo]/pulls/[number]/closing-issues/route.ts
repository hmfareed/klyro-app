import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getPRClosingIssueNumbers } from "@/server/git/issues/issue-reference-service";
import { getSessionUserId } from "@/shared/auth/session";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

// GET /api/v1/repositories/[owner]/[repo]/pulls/[number]/closing-issues
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);
  if (isNaN(prNumber)) return apiError("INVALID_NUMBER", "Invalid pull request number", null, 400);

  let userId: string | null = null;
  try {
    userId = await getSessionUserId();
  } catch {}

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
    select: {
      id: true,
      number: true,
      title: true,
      body: true,
      baseBranch: true,
      headBranch: true,
      status: true,
    },
  });

  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  try {
    const closingNumbers = await getPRClosingIssueNumbers(
      repository.gitStoragePath,
      pullRequest.baseBranch,
      pullRequest.headBranch,
      pullRequest.title,
      pullRequest.body
    );

    if (closingNumbers.length === 0) {
      return apiOk({ closingIssues: [], count: 0 });
    }

    const issues = await prisma.repositoryIssue.findMany({
      where: {
        repositoryId: repository.id,
        number: { in: closingNumbers },
      },
      select: {
        id: true,
        number: true,
        title: true,
        status: true,
        labels: true,
        closedAt: true,
        closedByPRId: true,
        author: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { number: "asc" },
    });

    return apiOk({
      closingIssues: issues,
      count: issues.length,
    });
  } catch (err: any) {
    return apiError("ERROR", err.message || "Failed to fetch closing issues", null, 500);
  }
}
