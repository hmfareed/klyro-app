import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import {
  initBareRepo,
  seedInitialCommit,
  getBranches,
  getTree,
  getFileBlob,
  createBranch,
  compareBranches,
  checkMergeConflict,
  getCommits,
  getCommitDiff,
  mergeBranches,
  getBlame,
  searchFiles,
} from "../src/server/git/git-service.ts";

async function runTest() {
  const testDir = path.join(os.tmpdir(), `klyro_test_git_${Date.now()}.git`);
  console.log("Testing in:", testDir);

  try {
    // 1. Init bare repo
    await initBareRepo(testDir, "main");
    console.log("✓ initBareRepo");

    // 2. Seed initial commit
    const sha = await seedInitialCommit(testDir, {
      defaultBranch: "main",
      files: [
        { path: "README.md", content: "# Hello Klyro\nTest repository content\nLine 3" },
        { path: "src/index.ts", content: "console.log('Hello world');\n" },
      ],
      message: "Initial commit",
      author: { name: "Fareed", email: "fareed@klyro.dev" },
    });
    console.log("✓ seedInitialCommit SHA:", sha);

    // 3. Branches
    const branches = await getBranches(testDir);
    console.log("✓ getBranches:", branches.map((b) => b.name));

    // 4. Tree
    const tree = await getTree(testDir, "main");
    console.log("✓ getTree root:", tree.entries.map((e) => `${e.name} (${e.type})`));

    // 5. Blob
    const file = await getFileBlob(testDir, "main", "README.md");
    console.log("✓ getFileBlob size:", file.size, "lines:", file.linesCount);

    // 6. Commits
    const commits = await getCommits(testDir, "main");
    console.log("✓ getCommits count:", commits.length);

    // 7. Commit diff
    const diff = await getCommitDiff(testDir, sha);
    console.log("✓ getCommitDiff files:", diff.files.map((f) => f.newPath));

    // 8. Create feature branch
    await createBranch(testDir, "feature-1", "main");
    console.log("✓ createBranch feature-1");

    // 9. Compare branches
    const compare = await compareBranches(testDir, "main", "feature-1");
    console.log("✓ compareBranches aheadBy:", compare.aheadBy, "conflicts:", compare.hasConflicts);

    // 10. Blame
    const blame = await getBlame(testDir, "main", "README.md");
    console.log("✓ getBlame lines:", blame.length);

    // 11. Search
    const search = await searchFiles(testDir, "main", "index");
    console.log("✓ searchFiles found:", search);

    console.log("\nALL GIT SERVICE TESTS PASSED SUCCESSFULLY!");
  } finally {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  }
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
