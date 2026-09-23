import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  initBareRepo,
  seedInitialCommit,
  createBranch,
  createCommitOnBranch,
  getRefCommitSha,
} from "../src/server/git/git-service.ts";
import { evaluateMergeGates } from "../src/server/git/policy/merge-gates.ts";
import { POST as mergeHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/merge/route.ts";
import { POST as updateBranchHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/update-branch/route.ts";
import { POST as statusHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/commits/[sha]/statuses/route.ts";
import { GET as gatesHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/gates/route.ts";

async function runTests() {
  console.log("=== Feature 5: PR Merge Gates & Policy Enforcement Integration Tests ===\n");
  const testId = Date.now();
  const testDir = path.join(os.tmpdir(), `klyro_test_gates_${testId}.git`);

  let ownerUser;
  let reviewer1;
  let reviewer2;
  let testRepo;
  let testPR;

  try {
    // 1. Setup Git Bare Repo
    await initBareRepo(testDir, "main");
    await seedInitialCommit(testDir, {
      defaultBranch: "main",
      files: [
        { path: "README.md", content: "# Main Repo\nInitial content\n" },
        { path: "package.json", content: '{"name": "test-app", "version": "1.0.0"}\n' },
      ],
      message: "Initial commit",
      author: { name: "System Admin", email: "admin@klyro.dev" },
    });

    // 2. Create Users in Database
    ownerUser = await prisma.user.create({
      data: {
        email: `owner_${testId}@klyro.dev`,
        username: `owner_${testId}`,
        displayName: "Repo Owner",
      },
    });

    reviewer1 = await prisma.user.create({
      data: {
        email: `rev1_${testId}@klyro.dev`,
        username: `rev1_${testId}`,
        displayName: "Reviewer One",
      },
    });

    reviewer2 = await prisma.user.create({
      data: {
        email: `rev2_${testId}@klyro.dev`,
        username: `rev2_${testId}`,
        displayName: "Reviewer Two",
      },
    });

    // 3. Create Repository in DB
    testRepo = await prisma.repository.create({
      data: {
        name: `gates-repo-${testId}`,
        slug: `gates-repo-${testId}`,
        ownerId: ownerUser.id,
        gitStoragePath: testDir,
        defaultBranch: "main",
        visibility: "PUBLIC",
      },
    });

    // 4. Configure Branch Protection Rule for "main"
    const rule = await prisma.branchProtectionRule.create({
      data: {
        repositoryId: testRepo.id,
        pattern: "main",
        requirePullRequest: true,
        requiredApprovals: 2,
        requireStatusChecks: true,
        requiredChecks: ["ci/build", "test"],
        requireUpToDateBranch: true,
        requireConversationResolution: true,
        preventForcePush: true,
        preventDeletion: true,
      },
    });
    console.log("✓ Created BranchProtectionRule with 2 approvals, CI checks, up-to-date branch, and conversations required.");

    // 5. Create Feature Branch & PR
    await createBranch(testDir, "feature/gates-feature", "main");
    await createCommitOnBranch(testDir, {
      branch: "feature/gates-feature",
      message: "feat: implement payment gateway",
      author: { name: "Dev", email: "dev@klyro.dev" },
      files: [{ path: "src/payment.ts", content: "export const pay = () => true;\n" }],
    });

    testPR = await prisma.pullRequest.create({
      data: {
        repositoryId: testRepo.id,
        number: 1,
        title: "feat: Payment integration",
        body: "Implements payment gateway",
        baseBranch: "main",
        headBranch: "feature/gates-feature",
        authorId: ownerUser.id,
      },
    });
    console.log(`✓ Created PR #${testPR.number}: "${testPR.title}"`);

    // -------------------------------------------------------------------------
    // TEST 1: Initial Gate Evaluation & Merge Attempt Rejection
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Initial Merge Gates Evaluation ---");
    let eval1 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });

    console.log(`✓ Initial canMerge: ${eval1.canMerge} (expected false)`);
    console.log(`✓ Failed required gates count: ${eval1.summary.failedRequired}`);
    console.log(`✓ Pending required gates count: ${eval1.summary.pendingRequired}`);
    if (eval1.canMerge) throw new Error("PR should NOT be mergeable initially!");

    // Verify rejection via merge route
    const dummyReq = new Request("http://localhost/api/merge", {
      method: "POST",
      body: JSON.stringify({ strategy: "MERGE_COMMIT" }),
      headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
    });
    const mergeBlockedRes = await mergeHandler(dummyReq, {
      params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, number: "1" }),
    });
    const mergeBlockedData = await mergeBlockedRes.json();
    console.log(`✓ POST /merge returned status ${mergeBlockedRes.status}: "${mergeBlockedData.error?.message}"`);
    if (mergeBlockedRes.status !== 400 || mergeBlockedData.error?.code !== "BRANCH_PROTECTION_BLOCKED") {
      throw new Error(`Expected 400 BRANCH_PROTECTION_BLOCKED, got: ${JSON.stringify(mergeBlockedData)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Approvals Gate (Reviews & Changes Requested)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Approvals Policy Enforcement ---");
    // Add 1 approval
    await prisma.pullRequestReview.create({
      data: {
        pullRequestId: testPR.id,
        reviewerId: reviewer1.id,
        state: "APPROVED",
        body: "LGTM!",
      },
    });

    let evalApprovals1 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const approvalsGate1 = evalApprovals1.gates.find((g) => g.id === "approvals");
    console.log(`✓ 1 approval received: gate status = ${approvalsGate1.status} ("${approvalsGate1.description}")`);
    if (approvalsGate1.status !== "FAILED") throw new Error("1 approval should still fail when 2 required!");

    // Reviewer 2 requests changes
    await prisma.pullRequestReview.create({
      data: {
        pullRequestId: testPR.id,
        reviewerId: reviewer2.id,
        state: "CHANGES_REQUESTED",
        body: "Need unit tests for error conditions.",
      },
    });

    let evalApprovals2 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const approvalsGate2 = evalApprovals2.gates.find((g) => g.id === "approvals");
    console.log(`✓ Changes requested: gate status = ${approvalsGate2.status} ("${approvalsGate2.description}")`);
    if (approvalsGate2.status !== "FAILED" || !approvalsGate2.description.includes("Changes requested")) {
      throw new Error("CHANGES_REQUESTED should block approval gate!");
    }

    // Reviewer 2 re-reviews and approves
    await prisma.pullRequestReview.create({
      data: {
        pullRequestId: testPR.id,
        reviewerId: reviewer2.id,
        state: "APPROVED",
        body: "Changes addressed, looks great now!",
      },
    });

    let evalApprovals3 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const approvalsGate3 = evalApprovals3.gates.find((g) => g.id === "approvals");
    console.log(`✓ 2 approvals received: gate status = ${approvalsGate3.status} ("${approvalsGate3.description}")`);
    if (approvalsGate3.status !== "PASSED") throw new Error("2 approvals should pass gate!");

    // -------------------------------------------------------------------------
    // TEST 3: Continuous Integration & Commit Status Checks
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Status Checks Policy Enforcement ---");
    const headSha = await getRefCommitSha(testDir, testPR.headBranch);
    console.log(`✓ Head commit SHA: ${headSha}`);

    // Post PENDING for ci/build
    await statusHandler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
        body: JSON.stringify({ state: "PENDING", context: "ci/build", description: "Build in progress" }),
      }),
      { params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, sha: headSha }) }
    );

    let evalCI1 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const ciGate1 = evalCI1.gates.find((g) => g.id === "status_checks");
    console.log(`✓ CI status check pending: ${ciGate1.status} ("${ciGate1.description}")`);
    if (ciGate1.status !== "PENDING") throw new Error("Status check gate should be PENDING");

    // Post FAILURE for test
    await statusHandler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
        body: JSON.stringify({ state: "FAILURE", context: "test", description: "1 test failed" }),
      }),
      { params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, sha: headSha }) }
    );

    let evalCI2 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const ciGate2 = evalCI2.gates.find((g) => g.id === "status_checks");
    console.log(`✓ CI check failed: ${ciGate2.status} ("${ciGate2.description}")`);
    if (ciGate2.status !== "FAILED") throw new Error("Failing check should fail gate");

    // Post SUCCESS for both ci/build and test
    await statusHandler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
        body: JSON.stringify({ state: "SUCCESS", context: "ci/build", description: "Build successful" }),
      }),
      { params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, sha: headSha }) }
    );
    await statusHandler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
        body: JSON.stringify({ state: "SUCCESS", context: "test", description: "All 42 tests passed" }),
      }),
      { params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, sha: headSha }) }
    );

    let evalCI3 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const ciGate3 = evalCI3.gates.find((g) => g.id === "status_checks");
    console.log(`✓ All CI checks passed: ${ciGate3.status} ("${ciGate3.description}")`);
    if (ciGate3.status !== "PASSED") throw new Error("Status checks gate should be PASSED");

    // -------------------------------------------------------------------------
    // TEST 4: Conversation Resolution Policy
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Conversation Resolution Enforcement ---");
    // Create an unresolved review discussion
    const unresComment = await prisma.pullRequestComment.create({
      data: {
        pullRequestId: testPR.id,
        authorId: reviewer1.id,
        body: "Can we rename this function?",
        diffPath: "src/payment.ts",
        diffLine: 1,
      },
    });

    let evalConv1 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const convGate1 = evalConv1.gates.find((g) => g.id === "conversations");
    console.log(`✓ Unresolved comment thread: ${convGate1.status} ("${convGate1.description}")`);
    if (convGate1.status !== "FAILED") throw new Error("Unresolved comment should fail conversation gate");

    // Resolve conversation
    await prisma.pullRequestComment.update({
      where: { id: unresComment.id },
      data: { resolvedAt: new Date(), resolvedById: ownerUser.id },
    });

    let evalConv2 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const convGate2 = evalConv2.gates.find((g) => g.id === "conversations");
    console.log(`✓ Comment thread resolved: ${convGate2.status} ("${convGate2.description}")`);
    if (convGate2.status !== "PASSED") throw new Error("Resolved conversation should pass gate");

    // -------------------------------------------------------------------------
    // TEST 5: Branch Freshness & One-Click "Update Branch"
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Branch Freshness & One-Click 'Update Branch' ---");
    // Advance main branch so feature branch is behind
    await createCommitOnBranch(testDir, {
      branch: "main",
      message: "chore: update documentation on main",
      author: { name: "Doc Writer", email: "docs@klyro.dev" },
      files: [{ path: "CONTRIBUTING.md", content: "# Contributing Guidelines\n" }],
    });

    let evalFreshness1 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const freshGate1 = evalFreshness1.gates.find((g) => g.id === "up_to_date");
    console.log(`✓ Branch behind main: ${freshGate1.status} ("${freshGate1.description}")`);
    console.log(`✓ evalFreshness1.canMerge: ${evalFreshness1.canMerge} (expected false)`);
    if (freshGate1.status !== "FAILED" || evalFreshness1.canMerge) {
      throw new Error("Branch behind main should fail freshness gate and block merge");
    }

    // Call one-click update-branch API
    const updateRes = await updateBranchHandler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "x-user-id": ownerUser.id },
      }),
      { params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, number: "1" }) }
    );
    const updateData = await updateRes.json();
    console.log(`✓ POST /update-branch status ${updateRes.status}: "${updateData.data?.message}"`);
    if (updateRes.status !== 200 || !updateData.success) {
      throw new Error(`updateBranch failed: ${JSON.stringify(updateData)}`);
    }

    // Head commit changed, re-register CI status checks for the new merge head commit
    const newHeadSha = await getRefCommitSha(testDir, testPR.headBranch);
    await statusHandler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
        body: JSON.stringify({ state: "SUCCESS", context: "ci/build", description: "Build passed" }),
      }),
      { params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, sha: newHeadSha }) }
    );
    await statusHandler(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
        body: JSON.stringify({ state: "SUCCESS", context: "test", description: "Tests passed" }),
      }),
      { params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, sha: newHeadSha }) }
    );

    let evalFreshness2 = await evaluateMergeGates({
      repositoryId: testRepo.id,
      gitStoragePath: testDir,
      pullRequest: testPR,
    });
    const freshGate2 = evalFreshness2.gates.find((g) => g.id === "up_to_date");
    console.log(`✓ Branch updated: ${freshGate2.status} ("${freshGate2.description}")`);
    console.log(`✓ All gates passed! canMerge: ${evalFreshness2.canMerge} (expected true)`);
    if (!evalFreshness2.canMerge) {
      throw new Error(`Expected canMerge to be true, failed gates: ${JSON.stringify(evalFreshness2.gates)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Successful Merge After Satisfying All Gates
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Successful Merge After Passing All Gates ---");
    const mergeReq = new Request("http://localhost/api/merge", {
      method: "POST",
      body: JSON.stringify({ strategy: "SQUASH", commitTitle: "feat: Payment integration (#1)" }),
      headers: { "Content-Type": "application/json", "x-user-id": ownerUser.id },
    });
    const mergeRes = await mergeHandler(mergeReq, {
      params: Promise.resolve({ owner: ownerUser.username, repo: testRepo.slug, number: "1" }),
    });
    const mergeData = await mergeRes.json();
    console.log(`✓ POST /merge status ${mergeRes.status}: mergeCommitSha = ${mergeData.data?.mergeCommitSha}`);
    if (mergeRes.status !== 200 || !mergeData.success) {
      throw new Error(`Merge failed: ${JSON.stringify(mergeData)}`);
    }

    // Verify DB PR status is MERGED
    const finalPR = await prisma.pullRequest.findUnique({ where: { id: testPR.id } });
    console.log(`✓ Final PullRequest status in DB: ${finalPR.status}, strategy: ${finalPR.mergeStrategy}`);
    if (finalPR.status !== "MERGED") {
      throw new Error("PR status was not updated to MERGED");
    }

    console.log("\n=======================================================");
    console.log("ALL FEATURE 5 PR MERGE GATES TESTS PASSED SUCCESSFULLY!");
    console.log("=======================================================");
  } finally {
    // Cleanup DB records
    if (testPR) {
      await prisma.pullRequestComment.deleteMany({ where: { pullRequestId: testPR.id } }).catch(() => {});
      await prisma.pullRequestReview.deleteMany({ where: { pullRequestId: testPR.id } }).catch(() => {});
      await prisma.pullRequest.deleteMany({ where: { repositoryId: testRepo?.id } }).catch(() => {});
    }
    if (testRepo) {
      await prisma.commitStatus.deleteMany({ where: { repositoryId: testRepo.id } }).catch(() => {});
      await prisma.branchProtectionRule.deleteMany({ where: { repositoryId: testRepo.id } }).catch(() => {});
      await prisma.repository.deleteMany({ where: { id: testRepo.id } }).catch(() => {});
    }
    if (ownerUser) await prisma.user.deleteMany({ where: { id: ownerUser.id } }).catch(() => {});
    if (reviewer1) await prisma.user.deleteMany({ where: { id: reviewer1.id } }).catch(() => {});
    if (reviewer2) await prisma.user.deleteMany({ where: { id: reviewer2.id } }).catch(() => {});

    // Cleanup temp Git directory
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
