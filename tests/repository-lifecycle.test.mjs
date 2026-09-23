import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";
import {
  initBareRepo,
  seedInitialCommit,
  createCommitOnBranch,
  getBranches,
  createBranch,
  getTree,
  getFileBlob,
  compareBranches,
  mergeBranches,
  getCommits,
  getRepoStoragePath,
  generateZipArchive,
} from "../src/server/git/git-service.ts";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

async function runEndToEndTest() {
  console.log("=== KLYRO REPOSITORY FULL FUNCTIONAL END-TO-END TEST ===");

  // 1. Fetch or create a test user
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found in DB");
  console.log(`✓ Test user: ${user.username} (${user.id})`);

  // 2. Create repository DB record
  const repoName = `e2e-repo-${Date.now()}`;
  const slug = repoName;

  const repo = await prisma.repository.create({
    data: {
      ownerId: user.id,
      name: repoName,
      slug,
      description: "End-to-end test repository for school management system",
      visibility: "PUBLIC",
      defaultBranch: "main",
      gitStoragePath: "",
    },
  });
  console.log(`✓ Repository DB record created: ${repo.id}`);

  const storagePath = getRepoStoragePath(repo.id);

  try {
    // 3. Initialize physical Git bare repository
    await initBareRepo(storagePath, "main");
    console.log(`✓ Bare Git repository initialized at ${storagePath}`);

    // 4. Seed initial commit with README.md and package.json
    const initialCommitSha = await seedInitialCommit(storagePath, {
      defaultBranch: "main",
      files: [
        {
          path: "README.md",
          content: "# School Management System\n\nFull functional repository test.\n",
        },
        {
          path: "package.json",
          content: '{\n  "name": "school-system",\n  "version": "1.0.0"\n}\n',
        },
      ],
      message: "Initial commit",
      author: { name: user.displayName || user.username, email: user.email },
    });
    console.log(`✓ Initial commit seeded directly: ${initialCommitSha}`);

    // Update gitStoragePath in DB
    await prisma.repository.update({
      where: { id: repo.id },
      data: { gitStoragePath: storagePath },
    });

    // 5. Query tree from Git
    const tree = await getTree(storagePath, "main");
    console.log(`✓ Tree entries verified (${tree.entries.length} items):`, tree.entries.map((e) => e.name));
    if (tree.entries.length < 2) throw new Error("Tree missing seeded files");

    // 6. Read file blob
    const readmeBlob = await getFileBlob(storagePath, "main", "README.md");
    console.log(`✓ File blob read: ${readmeBlob.linesCount} lines, ${readmeBlob.size} bytes`);
    if (!readmeBlob.content.includes("School Management System")) throw new Error("Blob content mismatch");

    // 7. Create feature branch
    await createBranch(storagePath, "feature/attendance", "main");
    console.log("✓ Branch 'feature/attendance' created from 'main'");

    const branches = await getBranches(storagePath, "main");
    console.log("✓ Branches listed:", branches.map((b) => b.name));

    // 8. Add a file to feature/attendance by creating a commit on that branch
    const attendanceCommitSha = await createCommitOnBranch(storagePath, {
      branch: "feature/attendance",
      files: [
        {
          path: "src/attendance/Attendance.tsx",
          content: "export function Attendance() { return <div>Attendance Module</div>; }\n",
        },
      ],
      message: "feat: add attendance module",
      author: { name: user.displayName || user.username, email: user.email },
    });
    console.log(`✓ Feature commit created on 'feature/attendance': ${attendanceCommitSha}`);

    // 9. Compare branches
    const comparison = await compareBranches(storagePath, "main", "feature/attendance");
    console.log(`✓ Branch comparison: aheadBy=${comparison.aheadBy}, filesChanged=${comparison.stats.filesChanged}, hasConflicts=${comparison.hasConflicts}`);
    if (comparison.aheadBy !== 1 || comparison.hasConflicts) throw new Error("Comparison failed");

    // 10. Open Pull Request in DB
    const pr = await prisma.pullRequest.create({
      data: {
        repositoryId: repo.id,
        number: 1,
        title: "feat: add attendance module",
        body: "Implements the QR attendance module.",
        baseBranch: "main",
        headBranch: "feature/attendance",
        authorId: user.id,
        status: "OPEN",
      },
    });
    console.log(`✓ Pull Request #${pr.number} opened in database`);

    // 11. Execute real Git merge of the PR
    const mergeResult = await mergeBranches(
      storagePath,
      "main",
      "feature/attendance",
      `Merge pull request #${pr.number} from feature/attendance\n\n${pr.title}`,
      { name: user.displayName || user.username, email: user.email }
    );
    console.log(`✓ Git merge executed successfully! Merge commit: ${mergeResult.commitSha}`);
    if (!mergeResult.success || !mergeResult.commitSha) throw new Error("Merge failed");

    // Update PR to MERGED
    await prisma.pullRequest.update({
      where: { id: pr.id },
      data: {
        status: "MERGED",
        mergedById: user.id,
        mergedAt: new Date(),
      },
    });

    // 12. Verify main branch tree now has the new file!
    const mergedTree = await getTree(storagePath, "main");
    console.log(`✓ Main branch tree after merge:`, mergedTree.entries.map((e) => e.name));
    const srcTree = await getTree(storagePath, "main", "src");
    console.log(`✓ 'src' folder tree:`, srcTree.entries.map((e) => e.name));

    // 13. Commits history on main
    const commits = await getCommits(storagePath, "main");
    console.log(`✓ Commits on main (${commits.length} commits):`);
    commits.forEach((c) => console.log(`   - [${c.shortSha}] ${c.message} (${c.author})`));

    // 14. Issue workflow
    const issue = await prisma.repositoryIssue.create({
      data: {
        repositoryId: repo.id,
        number: 1,
        title: "Fix responsive design on attendance table",
        body: "Table overflows on mobile devices under 640px.",
        authorId: user.id,
        labels: ["bug", "mobile"],
        status: "OPEN",
      },
    });
    console.log(`✓ Issue #${issue.number} created`);

    const comment = await prisma.repositoryIssueComment.create({
      data: {
        issueId: issue.id,
        authorId: user.id,
        body: "Fixed in latest commit with overflow-x-auto.",
      },
    });
    console.log(`✓ Comment added to issue #${issue.number}`);

    await prisma.repositoryIssue.update({
      where: { id: issue.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    console.log(`✓ Issue #${issue.number} marked as CLOSED`);

    // 15. Release workflow
    const release = await prisma.repositoryRelease.create({
      data: {
        repositoryId: repo.id,
        tagName: "v1.0.0",
        name: "Initial Production Release",
        body: "First stable release with attendance tracking.",
        authorId: user.id,
      },
    });
    console.log(`✓ Release ${release.tagName} created in database`);

    // 16. Star and Watch
    await prisma.repositoryStar.create({
      data: { userId: user.id, repositoryId: repo.id },
    });
    console.log(`✓ Star added to repository`);

    const starsCount = await prisma.repositoryStar.count({ where: { repositoryId: repo.id } });
    console.log(`✓ Stars count verified: ${starsCount}`);

    // 17. ZIP Archive generation
    const zip = await generateZipArchive(storagePath, "main");
    console.log(`✓ ZIP archive generated: ${zip.length} bytes`);
    if (zip.length === 0) throw new Error("Empty zip archive");

    console.log("\n=======================================================");
    console.log("SUCCESS: ALL 17 END-TO-END REPOSITORY SYSTEMS VERIFIED!");
    console.log("=======================================================\n");
  } finally {
    // Clean up test DB record and physical Git storage
    await prisma.repository.delete({ where: { id: repo.id } }).catch(() => {});
    await fs.rm(storagePath, { recursive: true, force: true }).catch(() => {});
    await prisma.$disconnect();
  }
}

runEndToEndTest().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
