import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import {
  mergeBranches,
  squashMergeBranches,
  rebaseMergeBranches,
} from "@/server/git/git-service";
import { evaluateMergeGates } from "@/server/git/policy/merge-gates";
import { processPRMergeIssueClosures } from "@/server/git/issues/issue-reference-service";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

const mergeSchema = z.object({
  strategy: z.enum(["MERGE_COMMIT", "SQUASH", "REBASE"]).default("MERGE_COMMIT"),
  commitTitle: z.string().max(200).optional(),
  commitMessage: z.string().max(5000).optional(),
});

// POST /api/v1/repositories/[owner]/[repo]/pulls/[number]/merge — execute Git merge
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

  let userId: string | null = req.headers.get("x-user-id");
  if (!userId) {
    try {
      userId = await getSessionUserId();
    } catch {}
  }
  if (!userId) {
    const ownerRecord = await prisma.user.findFirst({ where: { username: owner }, select: { id: true } });
    if (ownerRecord) userId = ownerRecord.id;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (repository.archived || repository.status === "DELETION_PENDING") {
    return apiError("FORBIDDEN", "This repository is archived or pending deletion. Merging is disabled.", null, 403);
  }
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

  // Parse optional merge parameters
  const rawBody = await req.json().catch(() => ({}));
  const parsed = mergeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }
  const { strategy, commitTitle, commitMessage } = parsed.data;

  // Check branch protection rules and merge gates
  const gatesEvaluation = await evaluateMergeGates({
    repositoryId: repository.id,
    gitStoragePath: repository.gitStoragePath,
    pullRequest,
  });

  if (!gatesEvaluation.canMerge) {
    return apiError(
      "BRANCH_PROTECTION_BLOCKED",
      `Merge blocked by branch protection policy: ${gatesEvaluation.reasonsToBlock.join("; ")}`,
      null,
      400
    );
  }

  // Perform Git merge according to selected strategy
  let mergeResult: { success: boolean; commitSha?: string; rebasedCommitsCount?: number; error?: string };

  if (strategy === "SQUASH") {
    const defaultTitle = `${pullRequest.title} (#${pullRequest.number})`;
    const title = commitTitle?.trim() || defaultTitle;
    const desc = commitMessage !== undefined ? commitMessage.trim() : (pullRequest.body || "");
    const message = desc ? `${title}\n\n${desc}` : title;

    const prAuthor = await prisma.user.findUnique({
      where: { id: pullRequest.authorId },
      select: { displayName: true, username: true, email: true },
    });

    mergeResult = await squashMergeBranches(
      repository.gitStoragePath,
      pullRequest.baseBranch,
      pullRequest.headBranch,
      message,
      {
        name: prAuthor?.displayName || prAuthor?.username || user.displayName || user.username,
        email: prAuthor?.email || user.email,
      },
      {
        name: user.displayName || user.username,
        email: user.email,
      }
    );
  } else if (strategy === "REBASE") {
    mergeResult = await rebaseMergeBranches(
      repository.gitStoragePath,
      pullRequest.baseBranch,
      pullRequest.headBranch,
      {
        name: user.displayName || user.username,
        email: user.email,
      }
    );
  } else {
    // Default: MERGE_COMMIT (2-parent merge)
    const defaultTitle = `Merge pull request #${pullRequest.number} from ${pullRequest.headBranch}`;
    const title = commitTitle?.trim() || defaultTitle;
    const desc = commitMessage !== undefined ? commitMessage.trim() : pullRequest.title;
    const message = desc ? `${title}\n\n${desc}` : title;

    mergeResult = await mergeBranches(
      repository.gitStoragePath,
      pullRequest.baseBranch,
      pullRequest.headBranch,
      message,
      {
        name: user.displayName || user.username,
        email: user.email,
      }
    );
  }

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
      mergeStrategy: strategy,
      mergeCommitSha: mergeResult.commitSha,
    },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      mergedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  // Auto-close issues referenced with closing keywords (e.g. Fixes #123)
  const closedIssues = await processPRMergeIssueClosures({
    repositoryId: repository.id,
    projectId: repository.projectId,
    gitStoragePath: repository.gitStoragePath,
    pullRequest,
    mergeCommitSha: mergeResult.commitSha,
    userId,
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
        mergeStrategy: strategy,
        mergeCommitSha: mergeResult.commitSha,
        repoName: repository.name,
        repoSlug: repository.slug,
        closedIssuesCount: closedIssues.length,
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
      merge_strategy: strategy,
      merge_commit_sha: mergeResult.commitSha,
      closed_issues: closedIssues,
    },
  });

  return apiOk({
    success: true,
    strategy,
    mergeCommitSha: mergeResult.commitSha,
    pullRequest: updatedPR,
    closedIssues,
  });
}
