import { runGit, mergeBranches } from "../git-service";

export interface ForkSyncStatus {
  branch: string;
  ahead: number;
  behind: number;
  isUpToDate: boolean;
  canFastForward: boolean;
  hasConflicts: boolean;
  forkSha: string;
  upstreamSha: string;
}

export interface ForkSyncResult {
  success: boolean;
  commitSha: string;
  modeUsed: "ALREADY_UP_TO_DATE" | "FAST_FORWARD" | "MERGE" | "DISCARD";
  message?: string;
}

/**
 * Fetch upstream branch and determine divergence (ahead / behind / conflicts)
 */
export async function getForkSyncStatus(
  forkStoragePath: string,
  upstreamStoragePath: string,
  branch = "main"
): Promise<ForkSyncStatus> {
  // 1. Fetch upstream branch into isolated remote ref
  try {
    await runGit(forkStoragePath, [
      "fetch",
      upstreamStoragePath,
      `+refs/heads/${branch}:refs/remotes/upstream/${branch}`,
    ]);
  } catch (err: any) {
    throw new Error(`Failed to fetch upstream branch '${branch}': ${err.message}`);
  }

  // 2. Resolve commit SHAs
  const { stdout: forkShaOut } = await runGit(forkStoragePath, ["rev-parse", `refs/heads/${branch}`]);
  const { stdout: upstreamShaOut } = await runGit(forkStoragePath, ["rev-parse", `refs/remotes/upstream/${branch}`]);

  const forkSha = forkShaOut.trim();
  const upstreamSha = upstreamShaOut.trim();

  // 3. Calculate ahead / behind metrics
  const { stdout: aheadOut } = await runGit(forkStoragePath, [
    "rev-list",
    "--count",
    `refs/remotes/upstream/${branch}..refs/heads/${branch}`,
  ]);
  const ahead = parseInt(aheadOut.trim() || "0", 10);

  const { stdout: behindOut } = await runGit(forkStoragePath, [
    "rev-list",
    "--count",
    `refs/heads/${branch}..refs/remotes/upstream/${branch}`,
  ]);
  const behind = parseInt(behindOut.trim() || "0", 10);

  const isUpToDate = ahead === 0 && behind === 0;
  const canFastForward = ahead === 0 && behind > 0;

  // 4. Check for conflicts if branches have diverged
  let hasConflicts = false;
  if (ahead > 0 && behind > 0) {
    try {
      const { stdout: mergeTreeOut } = await runGit(forkStoragePath, [
        "merge-tree",
        "--write-tree",
        `refs/heads/${branch}`,
        `refs/remotes/upstream/${branch}`,
      ]);
      if (mergeTreeOut.includes("CONFLICT")) {
        hasConflicts = true;
      }
    } catch {
      hasConflicts = true;
    }
  }

  return {
    branch,
    ahead,
    behind,
    isUpToDate,
    canFastForward,
    hasConflicts,
    forkSha,
    upstreamSha,
  };
}

/**
 * Synchronize fork branch with upstream
 */
export async function syncForkWithUpstream(
  forkStoragePath: string,
  upstreamStoragePath: string,
  branch = "main",
  mode: "AUTO" | "FAST_FORWARD" | "MERGE" | "DISCARD" = "AUTO",
  author: { name: string; email: string } = { name: "Klyro Sync", email: "bot@klyro.dev" }
): Promise<ForkSyncResult> {
  const status = await getForkSyncStatus(forkStoragePath, upstreamStoragePath, branch);

  // 1. Hard reset / discard mode
  if (mode === "DISCARD") {
    await runGit(forkStoragePath, ["update-ref", `refs/heads/${branch}`, status.upstreamSha]);
    return {
      success: true,
      commitSha: status.upstreamSha,
      modeUsed: "DISCARD",
      message: `Reset '${branch}' to match upstream at ${status.upstreamSha.slice(0, 7)}. Discarded ${status.ahead} local commit(s).`,
    };
  }

  // 2. Already up to date
  if (status.isUpToDate) {
    return {
      success: true,
      commitSha: status.forkSha,
      modeUsed: "ALREADY_UP_TO_DATE",
      message: `Branch '${branch}' is already up to date with upstream.`,
    };
  }

  // 3. Fast-forward mode
  if (mode === "FAST_FORWARD" || (mode === "AUTO" && status.canFastForward)) {
    if (!status.canFastForward) {
      throw new Error(`Cannot fast-forward: branch '${branch}' has diverged (${status.ahead} ahead, ${status.behind} behind).`);
    }

    await runGit(forkStoragePath, ["update-ref", `refs/heads/${branch}`, status.upstreamSha]);
    return {
      success: true,
      commitSha: status.upstreamSha,
      modeUsed: "FAST_FORWARD",
      message: `Fast-forwarded '${branch}' to upstream commit ${status.upstreamSha.slice(0, 7)} (+${status.behind} commits).`,
    };
  }

  // 4. Merge mode
  if (mode === "MERGE" || (mode === "AUTO" && status.ahead > 0 && status.behind > 0)) {
    if (status.hasConflicts) {
      throw new Error("Merge conflicts detected between fork and upstream. Please resolve conflicts locally or choose 'Discard commits'.");
    }

    const mergeMessage = `Merge upstream branch '${branch}' into '${branch}'`;
    const mergeRes = await mergeBranches(
      forkStoragePath,
      branch,
      `refs/remotes/upstream/${branch}`,
      mergeMessage,
      author
    );

    if (!mergeRes.success || !mergeRes.commitSha) {
      throw new Error(mergeRes.error || "Failed to merge upstream into fork");
    }

    return {
      success: true,
      commitSha: mergeRes.commitSha,
      modeUsed: "MERGE",
      message: `Merged upstream into '${branch}' via commit ${mergeRes.commitSha.slice(0, 7)}.`,
    };
  }

  throw new Error(`Unsupported sync mode: ${mode}`);
}
