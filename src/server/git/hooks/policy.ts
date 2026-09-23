import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/shared/db/prisma";

const execFileAsync = promisify(execFile);
const NULL_SHA = "0000000000000000000000000000000000000000";

export interface RefUpdateCommand {
  oldSha: string;
  newSha: string;
  refName: string;
}

export interface PolicyCheckResult {
  allowed: boolean;
  rejectReason?: string;
  remoteMessages: string[];
}

/**
 * Parses raw ref update lines from Git receive-pack (stdin or arguments)
 */
export function parseRefUpdateLines(rawLines: string): RefUpdateCommand[] {
  const updates: RefUpdateCommand[] = [];
  const lines = rawLines.trim().split("\n").filter(Boolean);

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      updates.push({
        oldSha: parts[0],
        newSha: parts[1],
        refName: parts[2],
      });
    }
  }

  return updates;
}

/**
 * Checks whether an update is a fast-forward update using git merge-base
 */
async function isFastForward(storagePath: string, oldSha: string, newSha: string): Promise<boolean> {
  if (oldSha === NULL_SHA || newSha === NULL_SHA) return true;
  try {
    await execFileAsync("git", ["merge-base", "--is-ancestor", oldSha, newSha], {
      cwd: storagePath,
      env: { ...process.env, GIT_DIR: storagePath },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluates repository branch protection policies for incoming push commands
 */
export async function evaluatePushPolicy(
  repositoryId: string,
  storagePath: string,
  updates: RefUpdateCommand[],
  userContext: { userId: string; canAdmin: boolean }
): Promise<PolicyCheckResult> {
  const remoteMessages: string[] = [];

  // Fetch branch protection rules for this repository
  const rules = await prisma.branchProtectionRule.findMany({
    where: { repositoryId },
  });

  for (const update of updates) {
    // Only check branch refs (refs/heads/...)
    if (!update.refName.startsWith("refs/heads/")) {
      continue;
    }

    const branchName = update.refName.replace("refs/heads/", "");
    const matchingRule = rules.find((r) => {
      if (r.pattern === branchName) return true;
      if (r.pattern.includes("*")) {
        const regex = new RegExp(`^${r.pattern.replace(/\*/g, ".*")}$`);
        return regex.test(branchName);
      }
      return false;
    });

    if (!matchingRule) {
      continue;
    }

    const isDeletion = update.newSha === NULL_SHA;
    const isCreation = update.oldSha === NULL_SHA;

    // 1. Check branch deletion rule
    if (isDeletion && matchingRule.preventDeletion) {
      const msg = `Branch deletion rejected: '${branchName}' is protected and cannot be deleted.`;
      remoteMessages.push(msg);
      return {
        allowed: false,
        rejectReason: msg,
        remoteMessages,
      };
    }

    // 2. Check force-push rule
    if (!isDeletion && !isCreation && matchingRule.preventForcePush) {
      const isFf = await isFastForward(storagePath, update.oldSha, update.newSha);
      if (!isFf) {
        // Admins can be allowed to bypass if specified, but by default protected branches reject force pushes
        const msg = `Force push rejected: '${branchName}' is protected and non-fast-forward updates are forbidden.`;
        remoteMessages.push(msg);
        return {
          allowed: false,
          rejectReason: msg,
          remoteMessages,
        };
      }
    }

    // 3. Check direct push requiring pull requests
    // If requirePullRequest is true and user is not bypassing
    if (!isDeletion && matchingRule.requirePullRequest && !userContext.canAdmin) {
      const msg = `Direct push rejected: '${branchName}' requires changes to be submitted via Pull Request.`;
      remoteMessages.push(msg);
      return {
        allowed: false,
        rejectReason: msg,
        remoteMessages,
      };
    }
  }

  return {
    allowed: true,
    remoteMessages,
  };
}
