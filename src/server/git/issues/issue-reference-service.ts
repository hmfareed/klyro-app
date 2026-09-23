import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/shared/db/prisma";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

const execFileAsync = promisify(execFile);

// Closing keywords: fixes, fixed, fix, closes, closed, close, resolves, resolved, resolve
export const CLOSING_KEYWORDS_REGEX =
  /(?:fixes|fixed|fix|closes|closed|close|resolves|resolved|resolve)\s+#(\d+)/gi;

// General issue reference pattern: #123
export const ISSUE_REFERENCE_REGEX = /(?:^|[^\w])#(\d+)/g;

/**
 * Extract closing issue numbers from text (e.g. "Fixes #42", "Closes #15")
 */
export function extractClosingIssueNumbers(text?: string | null): number[] {
  if (!text) return [];
  const numbers = new Set<number>();
  let match: RegExpExecArray | null;

  // Clone regex for stateful execution
  const regex = new RegExp(CLOSING_KEYWORDS_REGEX.source, "gi");
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) {
      numbers.add(num);
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Extract all issue references from text (e.g. "Refs #42 and #10")
 */
export function extractAllIssueReferences(text?: string | null): number[] {
  if (!text) return [];
  const numbers = new Set<number>();
  let match: RegExpExecArray | null;

  const regex = new RegExp(ISSUE_REFERENCE_REGEX.source, "g");
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) {
      numbers.add(num);
    }
  }

  return Array.from(numbers).sort((a, b) => a - b);
}

/**
 * Get all closing issue numbers for a PR from PR title, description, and commit messages
 */
export async function getPRClosingIssueNumbers(
  gitStoragePath: string,
  baseBranch: string,
  headBranch: string,
  prTitle: string,
  prBody?: string | null
): Promise<number[]> {
  const allNumbers = new Set<number>();

  // 1. From PR title and description
  extractClosingIssueNumbers(prTitle).forEach((n) => allNumbers.add(n));
  extractClosingIssueNumbers(prBody).forEach((n) => allNumbers.add(n));

  // 2. From commit messages in baseBranch..headBranch
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "--format=%B", `${baseBranch}..${headBranch}`],
      { cwd: gitStoragePath, encoding: "utf8" }
    );
    extractClosingIssueNumbers(stdout).forEach((n) => allNumbers.add(n));
  } catch {
    // If commit log fails, continue with title/body matches
  }

  return Array.from(allNumbers).sort((a, b) => a - b);
}

export interface ProcessPRMergeIssueClosuresParams {
  repositoryId: string;
  projectId?: string | null;
  gitStoragePath: string;
  pullRequest: {
    id: string;
    number: number;
    title: string;
    body?: string | null;
    baseBranch: string;
    headBranch: string;
  };
  mergeCommitSha: string;
  userId: string;
}

/**
 * Automatically close issues referenced with closing keywords when a PR is merged
 */
export async function processPRMergeIssueClosures({
  repositoryId,
  projectId,
  gitStoragePath,
  pullRequest,
  mergeCommitSha,
  userId,
}: ProcessPRMergeIssueClosuresParams) {
  const closingNumbers = await getPRClosingIssueNumbers(
    gitStoragePath,
    pullRequest.baseBranch,
    pullRequest.headBranch,
    pullRequest.title,
    pullRequest.body
  );

  if (closingNumbers.length === 0) {
    return [];
  }

  // Find matching open issues in this repository
  const openIssues = await prisma.repositoryIssue.findMany({
    where: {
      repositoryId,
      number: { in: closingNumbers },
      status: "OPEN",
    },
  });

  if (openIssues.length === 0) {
    return [];
  }

  const closedIssues = [];
  const shortSha = mergeCommitSha.slice(0, 7);

  for (const issue of openIssues) {
    // 1. Mark issue as CLOSED
    const updatedIssue = await prisma.repositoryIssue.update({
      where: { id: issue.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedById: userId,
        closedByPRId: pullRequest.id,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true } },
        closedBy: { select: { id: true, username: true, displayName: true } },
      },
    });

    // 2. Add automated closing comment
    await prisma.repositoryIssueComment.create({
      data: {
        issueId: issue.id,
        authorId: userId,
        body: `Closed by pull request #${pullRequest.number} in \`${shortSha}\`.`,
      },
    });

    // 3. Emit ActivityEvent if linked to a project
    if (projectId) {
      await recordActivityEvent({
        actorId: userId,
        projectId,
        type: ActivityEventType.ISSUE_RESOLVED, // maps to issue state update
        targetType: "RepositoryIssue",
        targetId: issue.id,
        metadata: {
          issueNumber: issue.number,
          title: issue.title,
          status: "CLOSED",
          closedByPRNumber: pullRequest.number,
          mergeCommitSha,
        },
      }).catch(() => {});
    }

    // 4. Dispatch repository webhooks
    dispatchRepositoryWebhooks({
      repositoryId,
      event: "issues",
      payload: {
        action: "closed",
        issue: updatedIssue,
        closed_by_pull_request: {
          number: pullRequest.number,
          title: pullRequest.title,
          commit_sha: mergeCommitSha,
        },
      },
    });

    closedIssues.push(updatedIssue);
  }

  return closedIssues;
}

export interface RecordPRReferenceEventsParams {
  repositoryId: string;
  pullRequest: {
    id: string;
    number: number;
    title: string;
    body?: string | null;
  };
  userId: string;
}

/**
 * Record cross-reference timeline events on mentioned issues when a PR is created or updated
 */
export async function recordPRReferenceEvents({
  repositoryId,
  pullRequest,
  userId,
}: RecordPRReferenceEventsParams) {
  const referencedNumbers = extractAllIssueReferences(
    `${pullRequest.title}\n\n${pullRequest.body || ""}`
  );

  if (referencedNumbers.length === 0) return;

  const issues = await prisma.repositoryIssue.findMany({
    where: {
      repositoryId,
      number: { in: referencedNumbers },
    },
    select: { id: true, number: true },
  });

  const refCommentMarker = `referenced this issue in pull request #${pullRequest.number}`;

  for (const issue of issues) {
    // Avoid duplicate reference comments
    const existing = await prisma.repositoryIssueComment.findFirst({
      where: {
        issueId: issue.id,
        body: { contains: refCommentMarker },
      },
    });

    if (!existing) {
      await prisma.repositoryIssueComment.create({
        data: {
          issueId: issue.id,
          authorId: userId,
          body: `${refCommentMarker}.`,
        },
      });
    }
  }
}
