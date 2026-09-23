import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  initBareRepo,
  seedInitialCommit,
  getBranches,
  createBranch,
  deleteBranch,
  getFileBlob,
  createCommitOnBranch,
  mergeBranches,
  squashMergeBranches,
  rebaseMergeBranches,
} from "../src/server/git/git-service.ts";

const execFileAsync = promisify(execFile);

async function runGit(cwd, args) {
  return execFileAsync("git", args, { cwd, encoding: "utf8" });
}

async function runTests() {
  console.log("=== Feature 4: PR Merge Engine & Merge Strategies Integration Tests ===\n");
  const testDir = path.join(os.tmpdir(), `klyro_test_merge_${Date.now()}.git`);

  try {
    // 0. Setup repository
    await initBareRepo(testDir, "main");
    await seedInitialCommit(testDir, {
      defaultBranch: "main",
      files: [
        { path: "README.md", content: "# Main Repo\nInitial content\n" },
        { path: "config.json", content: '{"version": 1}\n' },
      ],
      message: "Initial commit",
      author: { name: "System Admin", email: "admin@klyro.dev" },
    });
    console.log("✓ Initialized bare repository with initial commit on main");

    // -------------------------------------------------------------------------
    // TEST 1: Merge Commit Strategy (2 Parents)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Merge Commit Strategy (MERGE_COMMIT) ---");
    await createBranch(testDir, "feature/merge-commit", "main");
    await createCommitOnBranch(testDir, {
      branch: "feature/merge-commit",
      message: "feat: add feature-alpha.ts",
      author: { name: "Dev Alpha", email: "alpha@klyro.dev" },
      files: [{ path: "src/feature-alpha.ts", content: "export const alpha = 42;\n" }],
    });

    const mergeResult = await mergeBranches(
      testDir,
      "main",
      "feature/merge-commit",
      "Merge pull request #1 from feature/merge-commit\n\nAdd alpha feature",
      { name: "Merger Bot", email: "bot@klyro.dev" }
    );

    if (!mergeResult.success || !mergeResult.commitSha) {
      throw new Error(`mergeBranches failed: ${mergeResult.error}`);
    }

    // Inspect commit parents
    const { stdout: mergeParentsOut } = await runGit(testDir, [
      "rev-list",
      "--parents",
      "-n",
      "1",
      mergeResult.commitSha,
    ]);
    const mergeParents = mergeParentsOut.trim().split(" ").slice(1);
    console.log(`✓ Merge commit SHA: ${mergeResult.commitSha}`);
    console.log(`✓ Parents count: ${mergeParents.length} (expected 2)`);
    if (mergeParents.length !== 2) {
      throw new Error(`Expected 2 parents for MERGE_COMMIT, got ${mergeParents.length}`);
    }

    // Verify file exists on main
    const alphaBlob = await getFileBlob(testDir, "main", "src/feature-alpha.ts");
    if (!alphaBlob.content.includes("alpha = 42")) {
      throw new Error("Merged file content missing on main branch");
    }
    console.log("✓ Merged file verified on main branch");

    // -------------------------------------------------------------------------
    // TEST 2: Squash and Merge Strategy (1 Parent, combined changes)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Squash and Merge Strategy (SQUASH) ---");
    await createBranch(testDir, "feature/squash-test", "main");
    await createCommitOnBranch(testDir, {
      branch: "feature/squash-test",
      message: "wip: add part 1",
      author: { name: "Dev Beta", email: "beta@klyro.dev" },
      files: [{ path: "src/beta.ts", content: "export const step1 = true;\n" }],
    });
    await createCommitOnBranch(testDir, {
      branch: "feature/squash-test",
      message: "feat: finalize beta feature",
      author: { name: "Dev Beta", email: "beta@klyro.dev" },
      files: [{ path: "src/beta.ts", content: "export const step1 = true;\nexport const step2 = true;\n" }],
    });

    const squashResult = await squashMergeBranches(
      testDir,
      "main",
      "feature/squash-test",
      "Squash merge feature/squash-test (#2)\n\nCombined 2 commits",
      { name: "Dev Beta", email: "beta@klyro.dev" },
      { name: "Merger Bot", email: "bot@klyro.dev" }
    );

    if (!squashResult.success || !squashResult.commitSha) {
      throw new Error(`squashMergeBranches failed: ${squashResult.error}`);
    }

    // Inspect commit parents
    const { stdout: squashParentsOut } = await runGit(testDir, [
      "rev-list",
      "--parents",
      "-n",
      "1",
      squashResult.commitSha,
    ]);
    const squashParents = squashParentsOut.trim().split(" ").slice(1);
    console.log(`✓ Squash commit SHA: ${squashResult.commitSha}`);
    console.log(`✓ Parents count: ${squashParents.length} (expected 1)`);
    if (squashParents.length !== 1) {
      throw new Error(`Expected exactly 1 parent for SQUASH, got ${squashParents.length}`);
    }

    const betaBlob = await getFileBlob(testDir, "main", "src/beta.ts");
    if (!betaBlob.content.includes("step2 = true")) {
      throw new Error("Squashed file content missing step2");
    }
    console.log("✓ Squashed file contains all combined changes on main");

    // -------------------------------------------------------------------------
    // TEST 3: Rebase and Merge Strategy (Linear Replay)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Rebase and Merge Strategy (REBASE) ---");
    await createBranch(testDir, "feature/rebase-test", "main");

    // Add 2 commits to feature/rebase-test
    await createCommitOnBranch(testDir, {
      branch: "feature/rebase-test",
      message: "feat(gamma): part 1",
      author: { name: "Dev Gamma", email: "gamma@klyro.dev" },
      files: [{ path: "src/gamma-1.ts", content: "export const gamma1 = 1;\n" }],
    });
    await createCommitOnBranch(testDir, {
      branch: "feature/rebase-test",
      message: "feat(gamma): part 2",
      author: { name: "Dev Gamma", email: "gamma@klyro.dev" },
      files: [{ path: "src/gamma-2.ts", content: "export const gamma2 = 2;\n" }],
    });

    // Advance main with an independent commit to create branch divergence
    await createCommitOnBranch(testDir, {
      branch: "main",
      message: "chore: update documentation",
      author: { name: "Dev Delta", email: "delta@klyro.dev" },
      files: [{ path: "DOCS.md", content: "# Documentation\nUpdated docs.\n" }],
    });

    const rebaseResult = await rebaseMergeBranches(
      testDir,
      "main",
      "feature/rebase-test",
      { name: "Merger Bot", email: "bot@klyro.dev" }
    );

    if (!rebaseResult.success || !rebaseResult.commitSha) {
      throw new Error(`rebaseMergeBranches failed: ${rebaseResult.error}`);
    }

    console.log(`✓ Rebase successful. Final commit SHA: ${rebaseResult.commitSha}`);
    console.log(`✓ Rebased commits count: ${rebaseResult.rebasedCommitsCount} (expected 2)`);
    if (rebaseResult.rebasedCommitsCount !== 2) {
      throw new Error(`Expected 2 rebased commits, got ${rebaseResult.rebasedCommitsCount}`);
    }

    // Verify commit history linearity (last 2 commits on main should each have 1 parent)
    const { stdout: revLogOut } = await runGit(testDir, [
      "log",
      "-n",
      "3",
      "--format=%H %P | %s",
      "main",
    ]);
    const logLines = revLogOut.trim().split("\n");
    console.log("✓ Rebased linear history:");
    logLines.forEach((l) => console.log(`   ${l}`));

    for (const line of logLines) {
      const [hashAndParents] = line.split(" | ");
      const parts = hashAndParents.trim().split(" ");
      const parents = parts.slice(1);
      if (parents.length !== 1) {
        throw new Error(`Rebased commit should have exactly 1 parent, but got ${parents.length}: ${line}`);
      }
    }

    const gamma1 = await getFileBlob(testDir, "main", "src/gamma-1.ts");
    const gamma2 = await getFileBlob(testDir, "main", "src/gamma-2.ts");
    const docs = await getFileBlob(testDir, "main", "DOCS.md");
    if (!gamma1 || !gamma2 || !docs) {
      throw new Error("Rebased branch files missing from main!");
    }
    console.log("✓ All rebased files and concurrent base files present on main");

    // -------------------------------------------------------------------------
    // TEST 4: Branch Deletion (Post-Merge Cleanup)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Post-Merge Head Branch Deletion ---");
    const branchesBefore = await getBranches(testDir);
    if (!branchesBefore.some((b) => b.name === "feature/merge-commit")) {
      throw new Error("feature/merge-commit branch should exist before deletion");
    }

    await deleteBranch(testDir, "feature/merge-commit");
    const branchesAfter = await getBranches(testDir);
    if (branchesAfter.some((b) => b.name === "feature/merge-commit")) {
      throw new Error("feature/merge-commit branch was not deleted");
    }
    console.log("✓ Successfully deleted merged branch 'feature/merge-commit'");

    // -------------------------------------------------------------------------
    // TEST 5: Conflict Detection in Merge Strategies
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Conflict Detection in Merge Strategies ---");
    await createBranch(testDir, "feature/conflict-test", "main");
    // Modify README on branch
    await createCommitOnBranch(testDir, {
      branch: "feature/conflict-test",
      message: "conflict edit on branch",
      author: { name: "Dev Alpha", email: "alpha@klyro.dev" },
      files: [{ path: "README.md", content: "CONFLICT LINE FROM BRANCH\n" }],
    });
    // Modify README on main differently
    await createCommitOnBranch(testDir, {
      branch: "main",
      message: "conflict edit on main",
      author: { name: "Dev Beta", email: "beta@klyro.dev" },
      files: [{ path: "README.md", content: "DIFFERENT CONFLICT LINE ON MAIN\n" }],
    });

    const conflictMerge = await mergeBranches(
      testDir,
      "main",
      "feature/conflict-test",
      "Try conflict merge",
      { name: "Bot", email: "bot@klyro.dev" }
    );
    if (conflictMerge.success) {
      throw new Error("mergeBranches should have failed on conflict!");
    }
    console.log(`✓ mergeBranches correctly rejected conflict: "${conflictMerge.error}"`);

    const conflictSquash = await squashMergeBranches(
      testDir,
      "main",
      "feature/conflict-test",
      "Try conflict squash",
      { name: "Bot", email: "bot@klyro.dev" }
    );
    if (conflictSquash.success) {
      throw new Error("squashMergeBranches should have failed on conflict!");
    }
    console.log(`✓ squashMergeBranches correctly rejected conflict: "${conflictSquash.error}"`);

    const conflictRebase = await rebaseMergeBranches(
      testDir,
      "main",
      "feature/conflict-test",
      { name: "Bot", email: "bot@klyro.dev" }
    );
    if (conflictRebase.success) {
      throw new Error("rebaseMergeBranches should have failed on conflict!");
    }
    console.log(`✓ rebaseMergeBranches correctly rejected conflict: "${conflictRebase.error}"`);

    console.log("\n=======================================================");
    console.log("ALL FEATURE 4 MERGE STRATEGY TESTS PASSED SUCCESSFULLY!");
    console.log("=======================================================");
  } finally {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
