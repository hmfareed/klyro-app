import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  initBareRepo,
  seedInitialCommit,
  createCommitOnBranch,
  getBranches,
  getTree,
  getFileBlob,
  getCommits,
} from "../src/server/git/git-service.ts";
import { evaluatePushPolicy } from "../src/server/git/hooks/policy.ts";

async function runWebEditorTests() {
  console.log("=== STARTING WEB CODE EDITOR & COMMIT ENGINE TEST SUITE ===");

  const timestamp = Date.now();
  const testUsername = `editor_${timestamp}`;
  const repoSlug = `webeditor-${timestamp}`;
  const storageDir = path.join(process.cwd(), "data", "repositories", `editor_${timestamp}.git`);

  let testUser = null;
  let testRepo = null;

  try {
    // 1. Setup user & bare repository
    console.log("\n[1] Initializing user and bare repository...");
    testUser = await prisma.user.create({
      data: {
        username: testUsername,
        email: `editor_${timestamp}@klyro.dev`,
        displayName: "Web Editor User",
        status: "ACTIVE",
      },
    });

    await initBareRepo(storageDir, "main");
    await seedInitialCommit(storageDir, {
      defaultBranch: "main",
      files: [{ path: "README.md", content: "# Web Editor Test\nInitial repo." }],
      message: "Initial commit",
      author: { name: testUser.displayName, email: testUser.email },
    });

    testRepo = await prisma.repository.create({
      data: {
        ownerId: testUser.id,
        name: repoSlug,
        slug: repoSlug,
        visibility: "PUBLIC",
        defaultBranch: "main",
        gitStoragePath: storageDir,
      },
    });
    console.log("✓ Repository ready:", testRepo.slug);

    // 2. Test In-Browser File Creation (New file on main)
    console.log("\n[2] Testing in-browser new file creation (src/calculator.ts)...");
    const newFileContent = "export function add(a: number, b: number): number {\n  return a + b;\n}\n";
    const commit1 = await createCommitOnBranch(storageDir, {
      branch: "main",
      files: [{ path: "src/calculator.ts", content: newFileContent }],
      message: "Create calculator.ts",
      author: { name: testUser.displayName, email: testUser.email },
    });

    console.log("✓ Commit created on main:", commit1.commitSha.slice(0, 7));

    // Verify file exists in tree
    const tree = await getTree(storageDir, "main", "src");
    console.log("✓ Files in src/ tree:", tree.entries.map((e) => e.name));
    if (!tree.entries.some((e) => e.name === "calculator.ts")) {
      throw new Error("Created file 'calculator.ts' not found in tree!");
    }

    const blob = await getFileBlob(storageDir, "main", "src/calculator.ts");
    if (!blob.content.includes("export function add")) {
      throw new Error("File content in Git blob does not match created content!");
    }
    console.log("✓ Git blob content verified.");

    // 3. Test In-Browser File Edit (Modify existing file)
    console.log("\n[3] Testing in-browser file edit (Modify src/calculator.ts)...");
    const updatedContent = `${newFileContent}\nexport function multiply(a: number, b: number): number {\n  return a * b;\n}\n`;
    const commit2 = await createCommitOnBranch(storageDir, {
      branch: "main",
      files: [{ path: "src/calculator.ts", content: updatedContent }],
      message: "feat: add multiply function to calculator",
      author: { name: testUser.displayName, email: testUser.email },
    });

    console.log("✓ Edit commit created:", commit2.commitSha.slice(0, 7));
    const updatedBlob = await getFileBlob(storageDir, "main", "src/calculator.ts");
    if (!updatedBlob.content.includes("export function multiply")) {
      throw new Error("Edited content not reflected in Git blob!");
    }
    console.log("✓ Edited blob content verified.");

    // 4. Test Commit to a New Branch ("Create a new branch and start a PR")
    console.log("\n[4] Testing committing to a new branch (feature/patch-subtraction)...");
    const newBranchName = "feature/patch-subtraction";
    const subtractionContent = `${updatedContent}\nexport function subtract(a: number, b: number): number {\n  return a - b;\n}\n`;

    const commit3 = await createCommitOnBranch(storageDir, {
      branch: "main",
      newBranch: newBranchName,
      files: [{ path: "src/calculator.ts", content: subtractionContent }],
      message: "feat: add subtract function",
      author: { name: testUser.displayName, email: testUser.email },
    });

    console.log("✓ Commit created on branch", commit3.targetBranch, ":", commit3.commitSha.slice(0, 7));
    const branches = await getBranches(storageDir);
    console.log("✓ Repository branches:", branches.map((b) => b.name));

    if (!branches.some((b) => b.name === newBranchName)) {
      throw new Error("New branch was not created in remote!");
    }

    // Verify main branch is unchanged
    const mainBlob = await getFileBlob(storageDir, "main", "src/calculator.ts");
    if (mainBlob.content.includes("export function subtract")) {
      throw new Error("Base branch 'main' was unexpectedly modified!");
    }
    console.log("✓ Verified base branch 'main' remained untouched.");

    // Verify feature branch contains subtract
    const featureBlob = await getFileBlob(storageDir, newBranchName, "src/calculator.ts");
    if (!featureBlob.content.includes("export function subtract")) {
      throw new Error("Feature branch did not receive subtract function!");
    }
    console.log("✓ Verified feature branch has updated content.");

    // 5. Test File Deletion via Web Commit
    console.log("\n[5] Testing file deletion via Web commit...");
    const deleteCommit = await createCommitOnBranch(storageDir, {
      branch: "main",
      deletedPaths: ["README.md"],
      message: "Delete README.md",
      author: { name: testUser.displayName, email: testUser.email },
    });

    console.log("✓ Deletion commit created:", deleteCommit.commitSha.slice(0, 7));
    const rootTree = await getTree(storageDir, "main");
    if (rootTree.entries.some((e) => e.name === "README.md")) {
      throw new Error("Deleted file 'README.md' still present in tree!");
    }
    console.log("✓ Verified 'README.md' was removed from tree.");

    // 6. Test Branch Protection Gate on Web Commits
    console.log("\n[6] Testing branch protection gate against direct commits...");
    await prisma.branchProtectionRule.create({
      data: {
        repositoryId: testRepo.id,
        pattern: "main",
        requirePullRequest: true,
      },
    });

    const commitsOnMain = await getCommits(storageDir, "main");
    const parentSha = commitsOnMain[0].sha;

    const policyResult = await evaluatePushPolicy(
      testRepo.id,
      storageDir,
      [
        {
          oldSha: parentSha,
          newSha: "1111111111111111111111111111111111111111",
          refName: "refs/heads/main",
        },
      ],
      { userId: testUser.id, canAdmin: false }
    );

    console.log("✓ Direct commit to protected branch policy check: allowed =", policyResult.allowed);
    if (policyResult.allowed) {
      throw new Error("Branch protection failed to block direct push to protected branch!");
    }
    console.log("✓ Rejection message:", policyResult.rejectReason);

    console.log("\n========================================================");
    console.log("🎉 ALL WEB EDITOR & IN-BROWSER COMMIT TESTS PASSED 100%!");
    console.log("========================================================");
  } finally {
    await fs.rm(storageDir, { recursive: true, force: true }).catch(() => {});
    if (testRepo) {
      await prisma.repository.delete({ where: { id: testRepo.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runWebEditorTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
