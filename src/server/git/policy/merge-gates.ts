import { prisma } from "@/shared/db/prisma";
import {
  checkMergeConflict,
  isBranchUpToDate,
  getRefCommitSha,
} from "@/server/git/git-service";

export type GateStatus = "PASSED" | "FAILED" | "PENDING" | "SKIPPED";

export interface MergeGateItem {
  id: string;
  title: string;
  status: GateStatus;
  description: string;
  required: boolean;
  details?: Record<string, any>;
}

export interface MergeGateEvaluation {
  canMerge: boolean;
  pullRequestStatus: string;
  ruleMatched: boolean;
  rulePattern?: string;
  gates: MergeGateItem[];
  summary: {
    totalRequired: number;
    passedRequired: number;
    failedRequired: number;
    pendingRequired: number;
  };
  headCommitSha: string | null;
  behindBy: number;
  aheadBy: number;
  reasonsToBlock: string[];
}

export interface EvaluateGatesParams {
  repositoryId: string;
  gitStoragePath: string;
  pullRequest: {
    id: string;
    number: number;
    baseBranch: string;
    headBranch: string;
    authorId: string;
    status: string;
  };
}

/**
 * Evaluate all merge gates and branch protection policies for a Pull Request
 */
export async function evaluateMergeGates({
  repositoryId,
  gitStoragePath,
  pullRequest,
}: EvaluateGatesParams): Promise<MergeGateEvaluation> {
  const gates: MergeGateItem[] = [];
  const reasonsToBlock: string[] = [];

  // 1. Fetch branch protection rules for base branch
  const branchRules = await prisma.branchProtectionRule.findMany({
    where: { repositoryId },
  });

  // Find exact rule or wildcard rule
  const rule =
    branchRules.find((r) => r.pattern === pullRequest.baseBranch) ||
    branchRules.find((r) => r.pattern === "*" || r.pattern === "main");

  // 2. Head commit SHA and branch freshness
  const headCommitSha = await getRefCommitSha(gitStoragePath, pullRequest.headBranch);
  const freshness = await isBranchUpToDate(
    gitStoragePath,
    pullRequest.baseBranch,
    pullRequest.headBranch
  );

  // ---------------------------------------------------------------------------
  // GATE 1: Merge Conflicts (Always required)
  // ---------------------------------------------------------------------------
  const conflictCheck = await checkMergeConflict(
    gitStoragePath,
    pullRequest.baseBranch,
    pullRequest.headBranch
  );

  if (!conflictCheck.canMerge) {
    gates.push({
      id: "conflicts",
      title: "Merge Conflicts",
      status: "FAILED",
      description: "Merge conflicts detected. Must be resolved before merging.",
      required: true,
      details: { conflicts: conflictCheck.conflicts },
    });
    reasonsToBlock.push("Merge conflicts detected.");
  } else {
    gates.push({
      id: "conflicts",
      title: "Merge Conflicts",
      status: "PASSED",
      description: "No conflicts with base branch.",
      required: true,
    });
  }

  // ---------------------------------------------------------------------------
  // GATE 2: Required Approvals
  // ---------------------------------------------------------------------------
  const requiredApprovals = rule?.requiredApprovals ?? 0;
  const reviews = await prisma.pullRequestReview.findMany({
    where: { pullRequestId: pullRequest.id },
    orderBy: { createdAt: "desc" },
    include: {
      reviewer: { select: { id: true, username: true, displayName: true } },
    },
  });

  // Latest review per user
  const latestReviewsByUser = new Map<string, (typeof reviews)[0]>();
  for (const review of reviews) {
    if (!latestReviewsByUser.has(review.reviewerId)) {
      latestReviewsByUser.set(review.reviewerId, review);
    }
  }

  let approvedCount = 0;
  let changesRequestedCount = 0;
  const reviewersList: Array<{ name: string; state: string }> = [];

  for (const [, review] of latestReviewsByUser) {
    reviewersList.push({
      name: review.reviewer.displayName || review.reviewer.username,
      state: review.state,
    });
    if (review.state === "APPROVED") {
      approvedCount++;
    } else if (review.state === "CHANGES_REQUESTED") {
      changesRequestedCount++;
    }
  }

  if (requiredApprovals > 0) {
    if (changesRequestedCount > 0) {
      gates.push({
        id: "approvals",
        title: "Required Approvals",
        status: "FAILED",
        description: `Changes requested by ${changesRequestedCount} reviewer(s). Requests must be addressed.`,
        required: true,
        details: { requiredApprovals, approvedCount, changesRequestedCount, reviewers: reviewersList },
      });
      reasonsToBlock.push(`Changes requested by ${changesRequestedCount} reviewer(s).`);
    } else if (approvedCount >= requiredApprovals) {
      gates.push({
        id: "approvals",
        title: "Required Approvals",
        status: "PASSED",
        description: `${approvedCount} of ${requiredApprovals} required approval(s) received.`,
        required: true,
        details: { requiredApprovals, approvedCount, reviewers: reviewersList },
      });
    } else {
      gates.push({
        id: "approvals",
        title: "Required Approvals",
        status: "FAILED",
        description: `Requires at least ${requiredApprovals} approval(s). Currently has ${approvedCount}.`,
        required: true,
        details: { requiredApprovals, approvedCount, reviewers: reviewersList },
      });
      reasonsToBlock.push(`Requires at least ${requiredApprovals} approval(s). Currently has ${approvedCount}.`);
    }
  } else {
    gates.push({
      id: "approvals",
      title: "Required Approvals",
      status: "PASSED",
      description:
        approvedCount > 0
          ? `${approvedCount} approval(s) received (no minimum required).`
          : "No approvals required by policy.",
      required: false,
      details: { requiredApprovals: 0, approvedCount, reviewers: reviewersList },
    });
  }

  // ---------------------------------------------------------------------------
  // GATE 3: Continuous Integration & Status Checks
  // ---------------------------------------------------------------------------
  const requireStatusChecks = rule?.requireStatusChecks ?? false;
  const requiredChecks = rule?.requiredChecks ?? [];

  const commitStatuses = headCommitSha
    ? await prisma.commitStatus.findMany({
        where: { repositoryId, commitSha: headCommitSha },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const statusMap = new Map<string, (typeof commitStatuses)[0]>();
  for (const cs of commitStatuses) {
    if (!statusMap.has(cs.context)) {
      statusMap.set(cs.context, cs);
    }
  }

  if (requireStatusChecks) {
    if (requiredChecks.length === 0) {
      // Any status checks on head commit must pass
      const allStatuses = Array.from(statusMap.values());
      const hasFailed = allStatuses.some((s) => s.state === "FAILURE" || s.state === "ERROR");
      const hasPending = allStatuses.some((s) => s.state === "PENDING");

      if (allStatuses.length === 0) {
        gates.push({
          id: "status_checks",
          title: "Continuous Integration Checks",
          status: "PENDING",
          description: "Waiting for status checks to be reported.",
          required: true,
          details: { checks: [] },
        });
        reasonsToBlock.push("Waiting for status checks to report.");
      } else if (hasFailed) {
        gates.push({
          id: "status_checks",
          title: "Continuous Integration Checks",
          status: "FAILED",
          description: "One or more status checks failed.",
          required: true,
          details: { checks: allStatuses },
        });
        reasonsToBlock.push("One or more status checks failed.");
      } else if (hasPending) {
        gates.push({
          id: "status_checks",
          title: "Continuous Integration Checks",
          status: "PENDING",
          description: "Status checks are still running.",
          required: true,
          details: { checks: allStatuses },
        });
        reasonsToBlock.push("Status checks are still running.");
      } else {
        gates.push({
          id: "status_checks",
          title: "Continuous Integration Checks",
          status: "PASSED",
          description: `All ${allStatuses.length} check(s) passed.`,
          required: true,
          details: { checks: allStatuses },
        });
      }
    } else {
      // Specific checks required
      const failedChecks: string[] = [];
      const pendingChecks: string[] = [];
      const checksDetails: Array<{ context: string; state: string; description?: string | null }> = [];

      for (const checkName of requiredChecks) {
        const cs = statusMap.get(checkName);
        if (!cs) {
          pendingChecks.push(checkName);
          checksDetails.push({ context: checkName, state: "MISSING", description: "Not yet reported" });
        } else if (cs.state === "FAILURE" || cs.state === "ERROR") {
          failedChecks.push(checkName);
          checksDetails.push({ context: checkName, state: cs.state, description: cs.description });
        } else if (cs.state === "PENDING") {
          pendingChecks.push(checkName);
          checksDetails.push({ context: checkName, state: cs.state, description: cs.description });
        } else {
          checksDetails.push({ context: checkName, state: cs.state, description: cs.description });
        }
      }

      if (failedChecks.length > 0) {
        gates.push({
          id: "status_checks",
          title: "Continuous Integration Checks",
          status: "FAILED",
          description: `Required check(s) failed: ${failedChecks.join(", ")}.`,
          required: true,
          details: { checks: checksDetails, failedChecks, pendingChecks },
        });
        reasonsToBlock.push(`Required check(s) failed: ${failedChecks.join(", ")}.`);
      } else if (pendingChecks.length > 0) {
        gates.push({
          id: "status_checks",
          title: "Continuous Integration Checks",
          status: "PENDING",
          description: `Waiting for required check(s): ${pendingChecks.join(", ")}.`,
          required: true,
          details: { checks: checksDetails, failedChecks, pendingChecks },
        });
        reasonsToBlock.push(`Waiting for required check(s): ${pendingChecks.join(", ")}.`);
      } else {
        gates.push({
          id: "status_checks",
          title: "Continuous Integration Checks",
          status: "PASSED",
          description: `All ${requiredChecks.length} required check(s) passed.`,
          required: true,
          details: { checks: checksDetails },
        });
      }
    }
  } else {
    // Optional status checks summary
    const allStatuses = Array.from(statusMap.values());
    gates.push({
      id: "status_checks",
      title: "Continuous Integration Checks",
      status: "PASSED",
      description:
        allStatuses.length > 0
          ? `${allStatuses.length} check(s) reported (no required checks enforced).`
          : "No status checks required by policy.",
      required: false,
      details: { checks: allStatuses },
    });
  }

  // ---------------------------------------------------------------------------
  // GATE 4: Branch Up-To-Date Freshness
  // ---------------------------------------------------------------------------
  const requireUpToDateBranch = rule?.requireUpToDateBranch ?? false;

  if (requireUpToDateBranch) {
    if (!freshness.isUpToDate) {
      gates.push({
        id: "up_to_date",
        title: "Branch Freshness",
        status: "FAILED",
        description: `Head branch is behind ${pullRequest.baseBranch} by ${freshness.behindBy} commit(s). Branch must be up to date.`,
        required: true,
        details: { behindBy: freshness.behindBy, aheadBy: freshness.aheadBy },
      });
      reasonsToBlock.push(`Head branch is behind ${pullRequest.baseBranch} by ${freshness.behindBy} commit(s).`);
    } else {
      gates.push({
        id: "up_to_date",
        title: "Branch Freshness",
        status: "PASSED",
        description: `Head branch is up to date with ${pullRequest.baseBranch}.`,
        required: true,
        details: { behindBy: 0, aheadBy: freshness.aheadBy },
      });
    }
  } else {
    gates.push({
      id: "up_to_date",
      title: "Branch Freshness",
      status: "PASSED",
      description: freshness.isUpToDate
        ? `Branch is up to date with ${pullRequest.baseBranch}.`
        : `Branch is behind by ${freshness.behindBy} commit(s) (update optional).`,
      required: false,
      details: { behindBy: freshness.behindBy, aheadBy: freshness.aheadBy },
    });
  }

  // ---------------------------------------------------------------------------
  // GATE 5: Conversation Resolution
  // ---------------------------------------------------------------------------
  const requireConversationResolution = rule?.requireConversationResolution ?? false;
  const rootComments = await prisma.pullRequestComment.findMany({
    where: { pullRequestId: pullRequest.id, parentId: null },
    select: { id: true, resolvedAt: true },
  });

  const unresolvedComments = rootComments.filter((c) => !c.resolvedAt);

  if (requireConversationResolution) {
    if (unresolvedComments.length > 0) {
      gates.push({
        id: "conversations",
        title: "Conversations Resolution",
        status: "FAILED",
        description: `${unresolvedComments.length} unresolved conversation thread(s). All conversations must be resolved.`,
        required: true,
        details: { unresolvedCount: unresolvedComments.length, totalThreads: rootComments.length },
      });
      reasonsToBlock.push(`${unresolvedComments.length} unresolved conversation thread(s).`);
    } else {
      gates.push({
        id: "conversations",
        title: "Conversations Resolution",
        status: "PASSED",
        description: "All conversation threads have been resolved.",
        required: true,
        details: { unresolvedCount: 0, totalThreads: rootComments.length },
      });
    }
  } else {
    gates.push({
      id: "conversations",
      title: "Conversations Resolution",
      status: "PASSED",
      description:
        unresolvedComments.length > 0
          ? `${unresolvedComments.length} unresolved conversation thread(s) (resolution optional).`
          : "All conversations resolved.",
      required: false,
      details: { unresolvedCount: unresolvedComments.length, totalThreads: rootComments.length },
    });
  }

  // ---------------------------------------------------------------------------
  // SUMMARY & OVERALL VERDICT
  // ---------------------------------------------------------------------------
  const requiredGates = gates.filter((g) => g.required);
  const passedRequired = requiredGates.filter((g) => g.status === "PASSED").length;
  const failedRequired = requiredGates.filter((g) => g.status === "FAILED").length;
  const pendingRequired = requiredGates.filter((g) => g.status === "PENDING").length;

  const canMerge =
    pullRequest.status === "OPEN" &&
    failedRequired === 0 &&
    pendingRequired === 0 &&
    conflictCheck.canMerge;

  return {
    canMerge,
    pullRequestStatus: pullRequest.status,
    ruleMatched: !!rule,
    rulePattern: rule?.pattern,
    gates,
    summary: {
      totalRequired: requiredGates.length,
      passedRequired,
      failedRequired,
      pendingRequired,
    },
    headCommitSha,
    behindBy: freshness.behindBy,
    aheadBy: freshness.aheadBy,
    reasonsToBlock,
  };
}
