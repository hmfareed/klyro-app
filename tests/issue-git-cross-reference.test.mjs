import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  initBareRepo,
  seedInitialCommit,
  createBranch,
  createCommitOnBranch,
} from "../src/server/git/git-service.ts";
import {
  extractClosingIssueNumbers,
  extractAllIssueReferences,
  getPRClosingIssueNumbers,
  recordPRReferenceEvents,
} from "../src/server/git/issues/issue-reference-service.ts";
import { POST as mergeHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/merge/route.ts";
import { GET as closingIssuesHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/closing-issues/route.ts";
import { GET as issueReferencesHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/issues/[number]/references/route.ts";

async function runTests() {
  console.log("=== Feature 6: Issue ↔ Git Cross-Referencing & Auto-Close Integration Tests ===\n");
  const testId = Date.now();
  const testDir = path.join(os.tmpdir(), `klyro_test_crossref_${testId}.git`);

  let ownerUser;
  let testRepo;
  let issue1;
  let issue2;
  let testPR;

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Unit Keyword Parsing & Regex Extraction
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Keyword Extraction & Parsing ---");
    const testText1 = "This pull request fixes #42, closes #10, and also resolves #88.";
    const closingNums = extractClosingIssueNumbers(testText1);
    console.log("✓ extractClosingIssueNumbers:", closingNums);
    if (JSON.stringify(closingNums) !== JSON.stringify([10, 42, 88])) {
      throw new Error(`Expected [10, 42, 88], got ${JSON.stringify(closingNums)}`);
    }

    const testText2 = "Just discussing #5 and #10 without closing words.";
    const nonClosing = extractClosingIssueNumbers(testText2);
    console.log("✓ Non-closing text extracted:", nonClosing);
    if (nonClosing.length !== 0) {
      throw new Error("Should not extract closing issues without closing keywords!");
    }

    const allRefs = extractAllIssueReferences(testText2);
    console.log("✓ extractAllIssueReferences:", allRefs);
    if (JSON.stringify(allRefs) !== JSON.stringify([5, 10])) {
      throw new Error(`Expected [5, 10], got ${JSON.stringify(allRefs)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Commit Message Closing Keyword Extraction
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Commit Message Keyword Extraction ---");
    await initBareRepo(testDir, "main");
    await seedInitialCommit(testDir, {
      defaultBranch: "main",
      files: [{ path: "README.md", content: "# Main Repo\n" }],
      message: "Initial commit",
      author: { name: "Admin", email: "admin@klyro.dev" },
    });

    await createBranch(testDir, "feature/crossref-test", "main");
    await createCommitOnBranch(testDir, {
      branch: "feature/crossref-test",
      message: "feat: add payment retry logic (Fixes #101)",
      author: { name: "Dev", email: "dev@klyro.dev" },
      files: [{ path: "src/retry.ts", content: "export const retry = 3;\n" }],
    });

    const prClosingFromCommits = await getPRClosingIssueNumbers(
      testDir,
      "main",
      "feature/crossref-test",
      "feat: Payments updates",
      "Description that Closes #102."
    );

    console.log("✓ PR closing issues from commits + body:", prClosingFromCommits);
    if (!prClosingFromCommits.includes(101) || !prClosingFromCommits.includes(102)) {
      throw new Error(`Expected both 101 and 102, got ${JSON.stringify(prClosingFromCommits)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Database Setup & PR Opening Cross-Referencing
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Issue Creation & PR Cross-Referencing Timeline ---");
    ownerUser = await prisma.user.create({
      data: {
        email: `issue_user_${testId}@klyro.dev`,
        username: `issue_user_${testId}`,
        displayName: "Issue Tester",
      },
    });

    testRepo = await prisma.repository.create({
      data: {
        name: `crossref-repo-${testId}`,
        slug: `crossref-repo-${testId}`,
        ownerId: ownerUser.id,
        gitStoragePath: testDir,
        defaultBranch: "main",
        visibility: "PUBLIC",
      },
    });

    // Create Issue 1 (will be referenced only)
    issue1 = await prisma.repositoryIssue.create({
      data: {
        repositoryId: testRepo.id,
        number: 1,
        title: "Bug in authentication redirect",
        body: "Redirects to /undefined after login.",
        authorId: ownerUser.id,
      },
    });

    // Create Issue 2 (will be marked with closing keyword 'Fixes #2')
    issue2 = await prisma.repositoryIssue.create({
      data: {
        repositoryId: testRepo.id,
        number: 2,
        title: "Missing payment webhook logging",
        body: "Webhooks do not record audit events.",
        authorId: ownerUser.id,
      },
    });

    console.log(`✓ Created Issue #1 and Issue #2 in DB`);

    // Create PR that references #1 and closes #2
    testPR = await prisma.pullRequest.create({
      data: {
        repositoryId: testRepo.id,
        number: 1,
        title: "fix: Webhooks and auth updates",
        body: "This PR discusses #1 and Fixes #2 completely.",
        baseBranch: "main",
        headBranch: "feature/crossref-test",
        authorId: ownerUser.id,
      },
    });

    // Trigger PR reference recording
    await recordPRReferenceEvents({
      repositoryId: testRepo.id,
      pullRequest: testPR,
      userId: ownerUser.id,
    });

    // Check comments on Issue 1 and Issue 2
    const issue1Comments = await prisma.repositoryIssueComment.findMany({
      where: { issueId: issue1.id },
    });
    console.log(`✓ Issue #1 timeline comments:`, issue1Comments.map((c) => c.body));
    if (!issue1Comments.some((c) => c.body.includes("referenced this issue in pull request #1"))) {
      throw new Error("Reference comment missing on Issue #1!");
    }

    // -------------------------------------------------------------------------
    // TEST 4: Closing Issues & References API Endpoints
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Closing Issues & Issue References APIs ---");
    const closingIssuesReq = new Request("http://localhost");
    const closingIssuesRes = await closingIssuesHandler(closingIssuesReq, {
      params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, number: "1" }),
    });
    const closingIssuesData = await closingIssuesRes.json();
    const closingIssuesList = closingIssuesData.closingIssues || closingIssuesData.data?.closingIssues || [];
    console.log(`✓ GET /pulls/1/closing-issues returned count:`, closingIssuesList.length);
    if (!closingIssuesList.some((ci) => ci.number === 2)) {
      throw new Error(`Expected Issue #2 in closing issues: ${JSON.stringify(closingIssuesData)}`);
    }

    const refReq = new Request("http://localhost");
    const refRes = await issueReferencesHandler(refReq, {
      params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, number: "1" }),
    });
    const refData = await refRes.json();
    const referencingPRs = refData.referencingPRs || refData.data?.referencingPRs || [];
    console.log(`✓ GET /issues/1/references referencing PRs count:`, referencingPRs.length);
    if (referencingPRs.length !== 1 || referencingPRs[0].number !== 1) {
      throw new Error(`Expected PR #1 in references of Issue #1: ${JSON.stringify(refData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Auto-Close on PR Merge
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Auto-Close Issue on PR Merge ---");
    const mergeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
      body: JSON.stringify({ strategy: "MERGE_COMMIT" }),
    });
    const mergeRes = await mergeHandler(mergeReq, {
      params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, number: "1" }),
    });
    const mergeData = await mergeRes.json();
    const closedCount = (mergeData.closedIssues || mergeData.data?.closedIssues || []).length;
    console.log(`✓ POST /merge status ${mergeRes.status}, closedIssues:`, closedCount);
    if (mergeRes.status !== 200 || !mergeData.success) {
      throw new Error(`Merge failed: ${JSON.stringify(mergeData)}`);
    }

    // Verify Issue 2 in DB is CLOSED and linked to PR 1
    const updatedIssue2 = await prisma.repositoryIssue.findUnique({
      where: { id: issue2.id },
      include: { closedByPR: true, closedBy: true },
    });

    console.log(`✓ Issue #2 status: ${updatedIssue2.status}`);
    console.log(`✓ Issue #2 closedAt: ${updatedIssue2.closedAt}`);
    console.log(`✓ Issue #2 closedBy: ${updatedIssue2.closedBy?.username}`);
    console.log(`✓ Issue #2 closedByPR: #${updatedIssue2.closedByPR?.number}`);

    if (updatedIssue2.status !== "CLOSED") {
      throw new Error(`Expected Issue #2 status to be CLOSED, got ${updatedIssue2.status}`);
    }
    if (!updatedIssue2.closedAt || updatedIssue2.closedByPR?.number !== 1) {
      throw new Error("Issue #2 closedAt or closedByPRId not correctly recorded!");
    }

    // Verify closing comment on Issue 2
    const issue2Comments = await prisma.repositoryIssueComment.findMany({
      where: { issueId: issue2.id },
    });
    console.log(`✓ Issue #2 comments:`, issue2Comments.map((c) => c.body));
    if (!issue2Comments.some((c) => c.body.includes("Closed by pull request #1"))) {
      throw new Error("Automated closing comment missing on Issue #2!");
    }

    // Verify Issue 1 (only referenced, not closed) remains OPEN
    const updatedIssue1 = await prisma.repositoryIssue.findUnique({ where: { id: issue1.id } });
    console.log(`✓ Issue #1 status: ${updatedIssue1.status} (expected OPEN)`);
    if (updatedIssue1.status !== "OPEN") {
      throw new Error("Issue #1 should have remained OPEN!");
    }

    console.log("\n===================================================================");
    console.log("ALL FEATURE 6 ISSUE CROSS-REFERENCING & AUTO-CLOSE TESTS PASSED!");
    console.log("===================================================================");
  } finally {
    // Cleanup DB
    if (testPR) {
      await prisma.pullRequest.deleteMany({ where: { repositoryId: testRepo?.id } }).catch(() => {});
    }
    if (issue1 || issue2) {
      await prisma.repositoryIssueComment.deleteMany({
        where: { issueId: { in: [issue1?.id, issue2?.id].filter(Boolean) } },
      }).catch(() => {});
      await prisma.repositoryIssue.deleteMany({ where: { repositoryId: testRepo?.id } }).catch(() => {});
    }
    if (testRepo) {
      await prisma.repository.deleteMany({ where: { id: testRepo.id } }).catch(() => {});
    }
    if (ownerUser) {
      await prisma.user.deleteMany({ where: { id: ownerUser.id } }).catch(() => {});
    }
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
