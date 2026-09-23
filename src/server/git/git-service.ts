import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";

const execFileAsync = promisify(execFile);

// Base directory for storing bare git repositories
export const GIT_STORAGE_ROOT =
  process.env.GIT_STORAGE_DIR || path.join(process.cwd(), "data", "repositories");

/**
 * Returns absolute path for a repository storage
 */
export function getRepoStoragePath(repoId: string): string {
  return path.join(GIT_STORAGE_ROOT, `${repoId}.git`);
}

/**
 * Helper to run git command on a bare repository
 */
export async function runGit(
  storagePath: string,
  args: string[],
  options: { env?: Record<string, string>; input?: Buffer | string; maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const env = {
    ...process.env,
    GIT_DIR: storagePath,
    ...options.env,
  };

  try {
    const result = await execFileAsync("git", args, {
      cwd: storagePath,
      env,
      maxBuffer: options.maxBuffer ?? 20 * 1024 * 1024, // 20 MB buffer
      encoding: "utf8",
    });
    return result;
  } catch (err: any) {
    const errorMsg = err.stderr || err.stdout || err.message;
    throw new Error(`Git error (git ${args.join(" ")}): ${errorMsg}`);
  }
}

/**
 * Initialize a bare repository on disk
 */
export async function initBareRepo(storagePath: string, defaultBranch = "main"): Promise<void> {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await execFileAsync("git", ["init", "--bare", "-b", defaultBranch, storagePath]);
  // Configure repo config for server and smart HTTP use
  await runGit(storagePath, ["config", "core.logAllRefUpdates", "true"]);
  await runGit(storagePath, ["config", "http.receivepack", "true"]);
  await runGit(storagePath, ["config", "http.uploadpack", "true"]);
}

/**
 * Seed initial commit with files (README.md, .gitignore, LICENSE, etc.) directly using Git plumbing
 */
export async function seedInitialCommit(
  storagePath: string,
  options: {
    defaultBranch?: string;
    files: Array<{ path: string; content: string }>;
    message?: string;
    author?: { name: string; email: string };
  }
): Promise<string> {
  const defaultBranch = options.defaultBranch || "main";
  const authorName = options.author?.name || "Klyro";
  const authorEmail = options.author?.email || "bot@klyro.dev";
  const message = options.message || "Initial commit";

  // Temporary index file for plumbing
  const tempIndexFile = path.join(os.tmpdir(), `klyro_idx_${randomBytes(8).toString("hex")}`);

  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_INDEX_FILE: tempIndexFile,
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_COMMITTER_NAME: authorName,
      GIT_COMMITTER_EMAIL: authorEmail,
    };

    // 1. Hash and add each file to the temporary index
    for (const file of options.files) {
      const tempBlobFile = path.join(os.tmpdir(), `klyro_blob_${randomBytes(8).toString("hex")}`);
      await fs.writeFile(tempBlobFile, file.content, "utf8");
      try {
        const { stdout: blobSha } = await execFileAsync("git", ["hash-object", "-w", tempBlobFile], {
          cwd: storagePath,
          env: { ...process.env, GIT_DIR: storagePath },
          encoding: "utf8",
        });

        const cleanBlobSha = blobSha.trim();

        // Add to index
        await execFileAsync(
          "git",
          ["update-index", "--add", "--cacheinfo", "100644", cleanBlobSha, file.path],
          { cwd: storagePath, env }
        );
      } finally {
        await fs.rm(tempBlobFile, { force: true }).catch(() => {});
      }
    }

    // 2. Write tree from index
    const { stdout: treeSha } = await execFileAsync("git", ["write-tree"], {
      cwd: storagePath,
      env,
      encoding: "utf8",
    });

    const cleanTreeSha = treeSha.trim();

    // 3. Create commit object
    const { stdout: commitSha } = await execFileAsync(
      "git",
      ["commit-tree", cleanTreeSha, "-m", message],
      { cwd: storagePath, env, encoding: "utf8" }
    );

    const cleanCommitSha = commitSha.trim();

    // 4. Update default branch ref
    await runGit(storagePath, ["update-ref", `refs/heads/${defaultBranch}`, cleanCommitSha]);

    // 5. Update HEAD symbolic ref
    await runGit(storagePath, ["symbolic-ref", "HEAD", `refs/heads/${defaultBranch}`]);

    return cleanCommitSha;
  } finally {
    await fs.rm(tempIndexFile, { force: true }).catch(() => {});
  }
}

/**
 * Create a new commit on an existing branch with a parent commit
 */
export async function createCommitOnBranch(
  storagePath: string,
  options: {
    branch: string;
    files: Array<{ path: string; content: string }>;
    message: string;
    author?: { name: string; email: string };
  }
): Promise<string> {
  const branch = options.branch;
  const authorName = options.author?.name || "Klyro";
  const authorEmail = options.author?.email || "bot@klyro.dev";
  const message = options.message || "Update files";

  const { stdout: parentShaOut } = await runGit(storagePath, ["rev-parse", branch]);
  const parentSha = parentShaOut.trim();

  const tempIndexFile = path.join(os.tmpdir(), `klyro_idx_${randomBytes(8).toString("hex")}`);

  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_INDEX_FILE: tempIndexFile,
      GIT_AUTHOR_NAME: authorName,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_COMMITTER_NAME: authorName,
      GIT_COMMITTER_EMAIL: authorEmail,
    };

    // Read the parent commit tree into the temporary index
    await execFileAsync("git", ["read-tree", parentSha], { cwd: storagePath, env });

    // Hash and update each file into the index
    for (const file of options.files) {
      const tempBlobFile = path.join(os.tmpdir(), `klyro_blob_${randomBytes(8).toString("hex")}`);
      await fs.writeFile(tempBlobFile, file.content, "utf8");
      try {
        const { stdout: blobSha } = await execFileAsync("git", ["hash-object", "-w", tempBlobFile], {
          cwd: storagePath,
          env: { ...process.env, GIT_DIR: storagePath },
          encoding: "utf8",
        });

        const cleanBlobSha = blobSha.trim();
        await execFileAsync(
          "git",
          ["update-index", "--add", "--cacheinfo", "100644", cleanBlobSha, file.path],
          { cwd: storagePath, env }
        );
      } finally {
        await fs.rm(tempBlobFile, { force: true }).catch(() => {});
      }
    }

    // Write updated tree
    const { stdout: treeSha } = await execFileAsync("git", ["write-tree"], {
      cwd: storagePath,
      env,
      encoding: "utf8",
    });

    const cleanTreeSha = treeSha.trim();

    // Create commit with parent
    const { stdout: commitSha } = await execFileAsync(
      "git",
      ["commit-tree", cleanTreeSha, "-p", parentSha, "-m", message],
      { cwd: storagePath, env, encoding: "utf8" }
    );

    const cleanCommitSha = commitSha.trim();

    // Update branch ref
    await runGit(storagePath, ["update-ref", `refs/heads/${branch}`, cleanCommitSha]);

    return cleanCommitSha;
  } finally {
    await fs.rm(tempIndexFile, { force: true }).catch(() => {});
  }
}

export interface GitBranchInfo {
  name: string;
  commitSha: string;
  isDefault: boolean;
}

/**
 * List branches in repository
 */
export async function getBranches(storagePath: string, defaultBranch = "main"): Promise<GitBranchInfo[]> {
  try {
    const { stdout } = await runGit(storagePath, [
      "for-each-ref",
      "--format=%(refname:short)|%(objectname)",
      "refs/heads/",
    ]);

    const lines = stdout.trim().split("\n").filter(Boolean);
    return lines.map((line) => {
      const [name, commitSha] = line.split("|");
      return {
        name,
        commitSha,
        isDefault: name === defaultBranch,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Create a new branch from a ref
 */
export async function createBranch(storagePath: string, branchName: string, fromRef: string): Promise<void> {
  // Validate branch name
  if (!branchName || branchName.includes("..") || branchName.startsWith("/") || branchName.endsWith("/")) {
    throw new Error("Invalid branch name");
  }
  await runGit(storagePath, ["branch", branchName, fromRef]);
}

/**
 * Delete a branch
 */
export async function deleteBranch(storagePath: string, branchName: string): Promise<void> {
  await runGit(storagePath, ["branch", "-D", branchName]);
}

export interface GitTagInfo {
  name: string;
  commitSha: string;
  message?: string;
  date?: string;
}

/**
 * List tags in repository
 */
export async function getTags(storagePath: string): Promise<GitTagInfo[]> {
  try {
    const { stdout } = await runGit(storagePath, [
      "for-each-ref",
      "--format=%(refname:short)|%(objectname)|%(contents:subject)|%(creatordate:iso)",
      "refs/tags/",
    ]);

    const lines = stdout.trim().split("\n").filter(Boolean);
    return lines.map((line) => {
      const [name, commitSha, message, date] = line.split("|");
      return { name, commitSha, message, date };
    });
  } catch {
    return [];
  }
}

/**
 * Create an annotated tag
 */
export async function createTag(
  storagePath: string,
  tagName: string,
  targetRef: string,
  message = ""
): Promise<void> {
  await runGit(storagePath, ["tag", "-a", tagName, targetRef, "-m", message || tagName]);
}

export interface GitTreeEntry {
  mode: string;
  type: "blob" | "tree";
  sha: string;
  name: string;
  path: string;
  size?: number;
  lastCommit?: {
    sha: string;
    message: string;
    author: string;
    date: string;
  };
}

/**
 * Get tree entries for a ref and subpath
 */
export async function getTree(
  storagePath: string,
  ref: string,
  subpath = ""
): Promise<{ entries: GitTreeEntry[]; latestCommit?: any }> {
  try {
    const treeRef = subpath ? `${ref}:${subpath}` : ref;
    const { stdout } = await runGit(storagePath, ["ls-tree", "-l", treeRef]);

    const lines = stdout.trim().split("\n").filter(Boolean);
    const entries: GitTreeEntry[] = [];

    for (const line of lines) {
      // Format: <mode> <type> <sha> <size or '-'>\t<name>
      const match = line.match(/^(\d+)\s+(blob|tree)\s+([a-f0-9]+)\s+([0-9]+|-)\t(.+)$/);
      if (!match) continue;

      const [, mode, type, sha, sizeStr, name] = match;
      const fullPath = subpath ? `${subpath}/${name}` : name;
      const size = sizeStr !== "-" ? parseInt(sizeStr, 10) : undefined;

      entries.push({
        mode,
        type: type as "blob" | "tree",
        sha,
        name,
        path: fullPath,
        size,
      });
    }

    // Sort: directories first, then alphabetical
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "tree" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Fetch commit info for top 25 files in directory (fast preview)
    const previewEntries = entries.slice(0, 25);
    await Promise.all(
      previewEntries.map(async (entry) => {
        try {
          const { stdout: logOut } = await runGit(storagePath, [
            "log",
            "-1",
            "--format=%h|%s|%an|%cr",
            ref,
            "--",
            entry.path,
          ]);
          const [sha, message, author, date] = logOut.trim().split("|");
          if (sha) {
            entry.lastCommit = { sha, message, author, date };
          }
        } catch {
          // ignore individual path log error
        }
      })
    );

    // Get latest commit on the branch/ref
    let latestCommit: any = null;
    try {
      const { stdout: latestOut } = await runGit(storagePath, [
        "log",
        "-1",
        "--format=%H|%h|%an|%ae|%aI|%cr|%s",
        ref,
      ]);
      const [fullSha, shortSha, author, email, isoDate, relativeDate, message] = latestOut.trim().split("|");
      if (fullSha) {
        latestCommit = { sha: fullSha, shortSha, author, email, date: isoDate, relativeDate, message };
      }
    } catch {}

    return { entries, latestCommit };
  } catch (err: any) {
    if (err.message.includes("fatal: Not a valid object name")) {
      return { entries: [] };
    }
    throw err;
  }
}

/**
 * Get file content and metadata
 */
export async function getFileBlob(
  storagePath: string,
  ref: string,
  filePath: string
): Promise<{ content: string; size: number; isBinary: boolean; sha: string; linesCount: number }> {
  // Get object sha and size
  const { stdout: lsOut } = await runGit(storagePath, ["ls-tree", "-l", ref, filePath]);
  const match = lsOut.trim().match(/^(\d+)\s+blob\s+([a-f0-9]+)\s+([0-9]+)\t/);
  const sha = match ? match[2] : "";
  const size = match ? parseInt(match[3], 10) : 0;

  // Retrieve raw buffer
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const child = spawn("git", ["cat-file", "-p", `${ref}:${filePath}`], {
      cwd: storagePath,
      env: { ...process.env, GIT_DIR: storagePath },
    });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (err) => reject(new Error(err.toString())));
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`git cat-file failed with code ${code}`));
    });
  });

  // Check if binary (checks for null byte in first 8000 bytes)
  let isBinary = false;
  const sample = buffer.subarray(0, 8000);
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      isBinary = true;
      break;
    }
  }

  const content = isBinary ? "" : buffer.toString("utf8");
  const linesCount = isBinary ? 0 : content.split("\n").length;

  return {
    content,
    size: buffer.length,
    isBinary,
    sha,
    linesCount,
  };
}

/**
 * Get raw file content for download
 */
export async function getRawFileBuffer(
  storagePath: string,
  ref: string,
  filePath: string
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn("git", ["cat-file", "-p", `${ref}:${filePath}`], {
      cwd: storagePath,
      env: { ...process.env, GIT_DIR: storagePath },
    });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (err) => reject(new Error(err.toString())));
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`Failed to load raw file: ${code}`));
    });
  });
}

export interface GitCommitInfo {
  sha: string;
  shortSha: string;
  author: string;
  email: string;
  date: string;
  relativeDate: string;
  message: string;
  parents: string[];
}

/**
 * List commits for a branch/ref with optional path filter
 */
export async function getCommits(
  storagePath: string,
  ref: string,
  options: { path?: string; limit?: number; skip?: number } = {}
): Promise<GitCommitInfo[]> {
  const limit = options.limit || 30;
  const skip = options.skip || 0;

  const args = [
    "log",
    `--format=%H|%h|%an|%ae|%aI|%cr|%s|%P`,
    `-n`,
    limit.toString(),
    `--skip`,
    skip.toString(),
    ref,
  ];

  if (options.path) {
    args.push("--", options.path);
  }

  try {
    const { stdout } = await runGit(storagePath, args);
    const lines = stdout.trim().split("\n").filter(Boolean);

    return lines.map((line) => {
      const [sha, shortSha, author, email, date, relativeDate, message, parentsStr] = line.split("|");
      return {
        sha,
        shortSha,
        author,
        email,
        date,
        relativeDate,
        message,
        parents: parentsStr ? parentsStr.split(" ") : [],
      };
    });
  } catch {
    return [];
  }
}

export interface GitDiffFile {
  oldPath?: string;
  newPath: string;
  status: "added" | "deleted" | "modified";
  additions: number;
  deletions: number;
  patch: string;
}

/**
 * Get commit details and full diff patch
 */
export async function getCommitDiff(
  storagePath: string,
  sha: string
): Promise<{
  commit: GitCommitInfo;
  stats: { additions: number; deletions: number; filesChanged: number };
  files: GitDiffFile[];
}> {
  // Commit info
  const { stdout: commitOut } = await runGit(storagePath, [
    "show",
    "-s",
    "--format=%H|%h|%an|%ae|%aI|%cr|%s|%P",
    sha,
  ]);

  const [fullSha, shortSha, author, email, date, relativeDate, message, parentsStr] =
    commitOut.trim().split("|");

  const commit: GitCommitInfo = {
    sha: fullSha,
    shortSha,
    author,
    email,
    date,
    relativeDate,
    message,
    parents: parentsStr ? parentsStr.split(" ") : [],
  };

  // Get patch diff
  const { stdout: diffOut } = await runGit(storagePath, ["show", "--format=", "-p", sha]);

  // Parse diff files
  const files = parseUnifiedDiff(diffOut);

  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const f of files) {
    totalAdditions += f.additions;
    totalDeletions += f.deletions;
  }

  return {
    commit,
    stats: {
      additions: totalAdditions,
      deletions: totalDeletions,
      filesChanged: files.length,
    },
    files,
  };
}

/**
 * Helper to parse git unified diff output into file patches
 */
function parseUnifiedDiff(diffText: string): GitDiffFile[] {
  const files: GitDiffFile[] = [];
  const fileChunks = diffText.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split("\n");
    const headerLine = lines[0]; // a/file.txt b/file.txt
    const pathsMatch = headerLine.match(/a\/(.+)\s+b\/(.+)/);
    if (!pathsMatch) continue;

    const oldPath = pathsMatch[1];
    const newPath = pathsMatch[2];

    let status: "added" | "deleted" | "modified" = "modified";
    if (chunk.includes("new file mode")) status = "added";
    else if (chunk.includes("deleted file mode")) status = "deleted";

    let additions = 0;
    let deletions = 0;
    for (const l of lines) {
      if (l.startsWith("+") && !l.startsWith("+++")) additions++;
      else if (l.startsWith("-") && !l.startsWith("---")) deletions++;
    }

    files.push({
      oldPath: status === "added" ? undefined : oldPath,
      newPath,
      status,
      additions,
      deletions,
      patch: `diff --git ${chunk}`,
    });
  }

  return files;
}

/**
 * Compare two branches (base vs head) for pull request creation
 */
export async function compareBranches(
  storagePath: string,
  baseBranch: string,
  headBranch: string
): Promise<{
  aheadBy: number;
  behindBy: number;
  commits: GitCommitInfo[];
  files: GitDiffFile[];
  stats: { additions: number; deletions: number; filesChanged: number };
  hasConflicts: boolean;
}> {
  // Count commits ahead / behind
  const { stdout: aheadOut } = await runGit(storagePath, [
    "rev-list",
    "--count",
    `${baseBranch}..${headBranch}`,
  ]);
  const aheadBy = parseInt(aheadOut.trim() || "0", 10);

  const { stdout: behindOut } = await runGit(storagePath, [
    "rev-list",
    "--count",
    `${headBranch}..${baseBranch}`,
  ]);
  const behindBy = parseInt(behindOut.trim() || "0", 10);

  // Commits between base and head
  const { stdout: commitsOut } = await runGit(storagePath, [
    "log",
    `--format=%H|%h|%an|%ae|%aI|%cr|%s|%P`,
    `${baseBranch}..${headBranch}`,
  ]);

  const commitLines = commitsOut.trim().split("\n").filter(Boolean);
  const commits: GitCommitInfo[] = commitLines.map((line) => {
    const [sha, shortSha, author, email, date, relativeDate, message, parentsStr] = line.split("|");
    return {
      sha,
      shortSha,
      author,
      email,
      date,
      relativeDate,
      message,
      parents: parentsStr ? parentsStr.split(" ") : [],
    };
  });

  // Diff between base and head
  const { stdout: diffOut } = await runGit(storagePath, ["diff", "-p", `${baseBranch}...${headBranch}`]);
  const files = parseUnifiedDiff(diffOut);

  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const f of files) {
    totalAdditions += f.additions;
    totalDeletions += f.deletions;
  }

  // Check conflicts
  const conflictCheck = await checkMergeConflict(storagePath, baseBranch, headBranch);

  return {
    aheadBy,
    behindBy,
    commits,
    files,
    stats: {
      additions: totalAdditions,
      deletions: totalDeletions,
      filesChanged: files.length,
    },
    hasConflicts: !conflictCheck.canMerge,
  };
}

/**
 * Check if a merge has conflicts using git merge-tree
 */
export async function checkMergeConflict(
  storagePath: string,
  baseBranch: string,
  headBranch: string
): Promise<{ canMerge: boolean; conflicts: string[] }> {
  try {
    const { stdout } = await runGit(storagePath, ["merge-tree", "--write-tree", baseBranch, headBranch]);
    // git merge-tree outputs clean tree sha or conflict details
    const lines = stdout.split("\n");
    const hasConflictLines = lines.some((l) => l.includes("CONFLICT") || l.includes("Auto-merging"));
    if (lines[0] && !hasConflictLines) {
      return { canMerge: true, conflicts: [] };
    }

    const conflicts = lines
      .filter((l) => l.includes("CONFLICT"))
      .map((l) => l.replace(/^CONFLICT\s*(\([^)]*\))?:\s*/, "").trim());

    return { canMerge: conflicts.length === 0, conflicts };
  } catch (err: any) {
    return { canMerge: false, conflicts: [err.message || "Merge conflict detected"] };
  }
}

/**
 * Execute Git merge of headBranch into baseBranch
 */
export async function mergeBranches(
  storagePath: string,
  baseBranch: string,
  headBranch: string,
  message: string,
  author: { name: string; email: string }
): Promise<{ success: boolean; commitSha?: string; error?: string }> {
  try {
    // 1. Check conflicts and compute merge tree
    const { stdout: mergeTreeOut } = await runGit(storagePath, [
      "merge-tree",
      "--write-tree",
      baseBranch,
      headBranch,
    ]);

    const lines = mergeTreeOut.trim().split("\n");
    const treeSha = lines[0].trim();
    if (!treeSha || lines.some((l) => l.includes("CONFLICT"))) {
      return { success: false, error: "Merge conflicts detected. Cannot automatically merge." };
    }

    // 2. Get base and head commit SHAs
    const { stdout: baseShaOut } = await runGit(storagePath, ["rev-parse", baseBranch]);
    const { stdout: headShaOut } = await runGit(storagePath, ["rev-parse", headBranch]);
    const baseSha = baseShaOut.trim();
    const headSha = headShaOut.trim();

    // 3. Create merge commit with two parents
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: author.name,
      GIT_AUTHOR_EMAIL: author.email,
      GIT_COMMITTER_NAME: author.name,
      GIT_COMMITTER_EMAIL: author.email,
    };

    const { stdout: commitShaOut } = await execFileAsync(
      "git",
      ["commit-tree", treeSha, "-p", baseSha, "-p", headSha, "-m", message],
      { cwd: storagePath, env, encoding: "utf8" }
    );

    const mergeCommitSha = commitShaOut.trim();

    // 4. Fast-forward / update baseBranch ref to the merge commit
    await runGit(storagePath, ["update-ref", `refs/heads/${baseBranch}`, mergeCommitSha]);

    return { success: true, commitSha: mergeCommitSha };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to merge branches" };
  }
}

export interface GitBlameLine {
  line: number;
  commitSha: string;
  author: string;
  date: string;
  content: string;
}

/**
 * Get blame information for each line of a file
 */
export async function getBlame(
  storagePath: string,
  ref: string,
  filePath: string
): Promise<GitBlameLine[]> {
  try {
    const { stdout } = await runGit(storagePath, ["blame", "--line-porcelain", ref, "--", filePath]);
    const lines = stdout.split("\n");

    const result: GitBlameLine[] = [];
    let currentSha = "";
    let currentAuthor = "";
    let currentDate = "";
    let lineNum = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^[0-9a-f]{40}\s+\d+\s+(\d+)/.test(line)) {
        const parts = line.split(" ");
        currentSha = parts[0];
        lineNum = parseInt(parts[2], 10);
      } else if (line.startsWith("author ")) {
        currentAuthor = line.replace("author ", "");
      } else if (line.startsWith("author-time ")) {
        const timestamp = parseInt(line.replace("author-time ", ""), 10) * 1000;
        currentDate = new Date(timestamp).toLocaleDateString();
      } else if (line.startsWith("\t")) {
        result.push({
          line: lineNum,
          commitSha: currentSha,
          author: currentAuthor,
          date: currentDate,
          content: line.slice(1),
        });
      }
    }

    return result;
  } catch {
    return [];
  }
}

/**
 * Search all file paths in a ref (for "Go to file" modal)
 */
export async function searchFiles(
  storagePath: string,
  ref: string,
  query = ""
): Promise<string[]> {
  try {
    const { stdout } = await runGit(storagePath, ["ls-tree", "-r", "--name-only", ref]);
    const allFiles = stdout.trim().split("\n").filter(Boolean);
    if (!query) return allFiles.slice(0, 100);

    const q = query.toLowerCase();
    return allFiles.filter((p) => p.toLowerCase().includes(q)).slice(0, 100);
  } catch {
    return [];
  }
}

/**
 * Generate a ZIP archive buffer of the repo at ref
 */
export async function generateZipArchive(storagePath: string, ref: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const child = spawn("git", ["archive", "--format=zip", ref], {
      cwd: storagePath,
      env: { ...process.env, GIT_DIR: storagePath },
    });

    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (err) => reject(new Error(err.toString())));
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`git archive failed with code ${code}`));
    });
  });
}
