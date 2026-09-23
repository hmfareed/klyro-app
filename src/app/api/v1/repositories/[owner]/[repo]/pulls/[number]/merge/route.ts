import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { mergeBranches } from "@/server/git/git-service";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

// POST /api/v1/repositories/[owner]/[repo]/pulls/[number]/merge — execute Git merge
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

  let userId = await getSessionUserId();
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) {
    return apiError("FORBIDDEN", "Write access required to merge pull requests", null, 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, email: true },
  });
  if (!user) return apiError("NOT_FOUND", "User not found", null, 404);

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
    include: { reviews: true },
  });
  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  if (pullRequest.status === "MERGED") {
    return apiError("ALREADY_MERGED", "This pull request has already been merged.", null, 400);
  }

  if (pullRequest.status === "CLOSED") {
    return apiError("CLOSED", "Cannot merge a closed pull request.", null, 400);
  }

  // Check branch protection rules for the base branch
  const rule = repository.branchRules?.find((r: any) => r.pattern === pullRequest.baseBranch);
  if (rule && rule.requiredApprovals > 0) {
    const approvedCount = pullRequest.reviews.filter((r) => r.state === "APPROVED").length;
    if (approvedCount < rule.requiredApprovals) {
      return apiError(
        "BRANCH_PROTECTION",
        `Base branch '${pullRequest.baseBranch}' requires at least ${rule.requiredApprovals} approval(s). Current: ${approvedCount}`,
        null,
        400
      );
    }
  }

  // Perform actual Git merge
  const mergeMessage = `Merge pull request #${pullRequest.number} from ${pullRequest.headBranch}\n\n${pullRequest.title}`;
  const mergeResult = await mergeBranches(
    repository.gitStoragePath,
    pullRequest.baseBranch,
    pullRequest.headBranch,
    mergeMessage,
    {
      name: user.displayName || user.username,
      email: user.email,
    }
  );

  if (!mergeResult.success || !mergeResult.commitSha) {
    return apiError("MERGE_FAILED", mergeResult.error || "Failed to execute Git merge", null, 400);
  }

  // Update PR status in database
  const updatedPR = await prisma.pullRequest.update({
    where: { id: pullRequest.id },
    data: {
      status: "MERGED",
      mergedById: userId,
      mergedAt: new Date(),
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      mergedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  // Emit Buildstream event if linked to project
  if (repository.projectId) {
    await recordActivityEvent({
      actorId: userId,
      projectId: repository.projectId,
      type: ActivityEventType.PULL_REQUEST_MERGED,
      targetType: "PullRequest",
      targetId: pullRequest.id,
      metadata: {
        number: pullRequest.number,
        title: pullRequest.title,
        baseBranch: pullRequest.baseBranch,
        headBranch: pullRequest.headBranch,
        mergeCommitSha: mergeResult.commitSha,
        repoName: repository.name,
        repoSlug: repository.slug,
      },
    });
  }

  // Dispatch webhooks
  dispatchRepositoryWebhooks({
    repositoryId: repository.id,
    event: "pull_request",
    payload: {
      action: "merged",
      pull_request: updatedPR,
      merge_commit_sha: mergeResult.commitSha,
    },
  });

  return apiOk({
    success: true,
    mergeCommitSha: mergeResult.commitSha,
    pullRequest: updatedPR,
  });
}
