import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getSessionUserId } from "@/shared/auth/session";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

// GET /api/v1/repositories/[owner]/[repo]/issues/[number]/references
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const issueNumber = parseInt(numStr, 10);
  if (isNaN(issueNumber)) return apiError("INVALID_NUMBER", "Invalid issue number", null, 400);

  let userId: string | null = null;
  try {
    userId = await getSessionUserId();
  } catch {}

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const issue = await prisma.repositoryIssue.findFirst({
    where: { repositoryId: repository.id, number: issueNumber },
    include: {
      closedByPR: {
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          mergeCommitSha: true,
        },
      },
    },
  });

  if (!issue) return apiError("NOT_FOUND", "Issue not found", null, 404);

  // Find PRs that mention this issue in title or body
  const referencingPRs = await prisma.pullRequest.findMany({
    where: {
      repositoryId: repository.id,
      OR: [
        { title: { contains: `#${issueNumber}` } },
        { body: { contains: `#${issueNumber}` } },
      ],
    },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      createdAt: true,
      mergedAt: true,
      author: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiOk({
    issueNumber: issue.number,
    status: issue.status,
    closedByPR: issue.closedByPR,
    referencingPRs,
  });
}
