import assert from "node:assert";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  initBareRepo,
  seedInitialCommit,
  createCommitOnBranch,
  runGit,
} from "../src/server/git/git-service.ts";
import { GET as workflowsListHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/actions/workflows/route.ts";
import {
  GET as actionsListHandler,
  POST as actionsPostHandler,
} from "../src/app/api/v1/repositories/[owner]/[repo]/actions/route.ts";
import {
  GET as actionDetailHandler,
  POST as actionCancelHandler,
} from "../src/app/api/v1/repositories/[owner]/[repo]/actions/[runId]/route.ts";
import { GET as commitStatusesHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/commits/[sha]/statuses/route.ts";
import { POST as createPrHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/route.ts";
import { GET as prGatesHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/pulls/[number]/gates/route.ts";

function unwrap(json) {
  return json?.data || json;
}

async function runTests() {
  console.log("=== Feature 10: CI/CD Action Runners Integration Tests ===\n");

  const timestamp = Date.now();
  const username = `ci_runner_${timestamp}`;
  const repoSlug = `repo-actions-${timestamp}`;

  let user;
  let repository;
  const storagePath = path.join(os.tmpdir(), `klyro_test_actions_${timestamp}.git`);

  try {
    // 1. Setup User and Repository
    user = await prisma.user.create({
      data: {
        email: `${username}@klyro.test`,
        username,
        displayName: "CI Engineer",
      },
    });

    repository = await prisma.repository.create({
      data: {
        ownerId: user.id,
        name: repoSlug,
        slug: repoSlug,
        defaultBranch: "main",
        visibility: "PUBLIC",
        gitStoragePath: storagePath,
      },
      include: { owner: true },
    });

    // 2. Initialize Bare Git Repo
    await initBareRepo(storagePath, "main");

    const passingWorkflowYaml = [
      "name: CI Pipeline",
      "on:",
      "  push:",
      "    branches: [ main ]",
      "  workflow_dispatch:",
      "jobs:",
      "  test:",
      "    name: Test Suite",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - name: Checkout Repository",
      "        uses: actions/checkout@v4",
      "      - name: Verify Node Environment",
      "        run: node --version",
      "      - name: Run Unit Tests",
      "        run: echo 'Executing test suite... 24 tests passed!'",
    ].join("\n");

    await seedInitialCommit(storagePath, {
      defaultBranch: "main",
      files: [
        { path: "README.md", content: "# CI Actions Test Repo\n" },
        { path: ".klyro/workflows/ci.yml", content: passingWorkflowYaml },
      ],
      message: "Initial commit with CI workflow",
      author: { name: "Alice", email: "alice@klyro.test" },
    });
    console.log("✓ Initialized repository with .klyro/workflows/ci.yml on main");

    // ==========================================
    // TEST 1: Workflow Discovery (.klyro/workflows/*.yml)
    // ==========================================
    console.log("\n--- TEST 1: Workflow Discovery in Git Tree ---");
    const wfReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/actions/workflows?ref=main`, {
      method: "GET",
      headers: { "x-user-id": user.id },
    });
    const wfRes = await workflowsListHandler(wfReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(wfRes.status, 200, "workflows route must return 200");
    const wfData = unwrap(await wfRes.json());
    assert(Array.isArray(wfData.workflows), "Must return workflows array");
    assert.strictEqual(wfData.workflows.length, 1, "Must find exactly 1 workflow");

    const foundWf = wfData.workflows[0];
    assert.strictEqual(foundWf.name, "CI Pipeline");
    assert.strictEqual(foundWf.path, ".klyro/workflows/ci.yml");
    assert(foundWf.jobs.test, "Must contain 'test' job");
    assert.strictEqual(foundWf.jobs.test.steps.length, 3, "Test job must have 3 steps");
    console.log(`✓ Discovered workflow '${foundWf.name}' with ${foundWf.jobs.test.steps.length} steps`);

    // ==========================================
    // TEST 2: Passing Workflow Dispatch & Execution
    // ==========================================
    console.log("\n--- TEST 2: Dispatch and Execute Passing Workflow ---");
    const dispatchReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({
        workflowPath: ".klyro/workflows/ci.yml",
        branch: "main",
        async: false,
      }),
    });
    const dispatchRes = await actionsPostHandler(dispatchReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(dispatchRes.status, 201, "dispatch should return 201 Created");
    const dispatchData = unwrap(await dispatchRes.json());
    const run1 = dispatchData.run;

    assert.strictEqual(run1.status, "SUCCESS", "Workflow run status must be SUCCESS");
    assert.strictEqual(run1.conclusion, "SUCCESS", "Workflow conclusion must be SUCCESS");
    assert(run1.durationMs > 0, "Duration must be greater than 0");
    assert(run1.logs.includes("Workflow completed successfully"), "Logs must indicate success");

    const steps = Array.isArray(run1.steps) ? run1.steps : JSON.parse(run1.steps || "[]");
    assert.strictEqual(steps.length, 3, "All 3 steps must have execution records");
    assert(steps.every((s) => s.status === "SUCCESS" && s.exitCode === 0), "All steps must succeed with code 0");
    console.log(`✓ Workflow executed successfully in ${(run1.durationMs / 1000).toFixed(2)}s`);
    console.log("✓ Step 1: " + steps[0].name + " -> " + steps[0].status);
    console.log("✓ Step 2: " + steps[1].name + " -> " + steps[1].status);
    console.log("✓ Step 3: " + steps[2].name + " -> " + steps[2].status);

    // Verify CommitStatus on Commit SHA
    const commitSha = run1.commitSha;
    const statusReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/commits/${commitSha}/statuses`, {
      method: "GET",
      headers: { "x-user-id": user.id },
    });
    const statusRes = await commitStatusesHandler(statusReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, sha: commitSha }),
    });
    assert.strictEqual(statusRes.status, 200);
    const statusData = unwrap(await statusRes.json());
    const statuses = statusData.statuses;
    const ciStatus = statuses.find((s) => s.context === "klyro-ci / CI Pipeline");
    assert(ciStatus, "CommitStatus with context 'klyro-ci / CI Pipeline' must exist");
    assert.strictEqual(ciStatus.state, "SUCCESS", "CommitStatus state must be SUCCESS");
    console.log(`✓ CommitStatus verified on ${commitSha.slice(0, 7)}: state=${ciStatus.state} (${ciStatus.description})`);

    // ==========================================
    // TEST 3: Failing Workflow & PR Merge Gate Enforcement
    // ==========================================
    console.log("\n--- TEST 3: Failing Workflow & PR Merge Gate Blocking ---");
    const failingWorkflowYaml = [
      "name: Linter & Tests",
      "on:",
      "  push:",
      "  workflow_dispatch:",
      "jobs:",
      "  lint:",
      "    name: Strict Linter",
      "    steps:",
      "      - name: Checkout Code",
      "        uses: actions/checkout@v4",
      "      - name: Run Linter",
      "        run: node -e \"console.error('Fatal linter syntax error on line 42'); process.exit(1)\"",
      "      - name: Should Be Skipped",
      "        run: echo 'This should never run'",
    ].join("\n");

    // Commit failing workflow on a feature branch
    const { commitSha: failingCommitSha } = await createCommitOnBranch(storagePath, {
      branch: "main",
      newBranch: "feature/failing-checks",
      message: "feat: add experimental code with strict linter",
      files: [{ path: ".klyro/workflows/lint.yml", content: failingWorkflowYaml }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });

    // Execute the failing workflow on feature/failing-checks
    const failDispatchReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({
        workflowPath: ".klyro/workflows/lint.yml",
        branch: "feature/failing-checks",
        async: false,
      }),
    });
    const failDispatchRes = await actionsPostHandler(failDispatchReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    const failRun = unwrap(await failDispatchRes.json()).run;
    assert.strictEqual(failRun.status, "FAILURE", "Run status must be FAILURE");
    assert.strictEqual(failRun.conclusion, "FAILURE", "Run conclusion must be FAILURE");

    const failSteps = Array.isArray(failRun.steps) ? failRun.steps : JSON.parse(failRun.steps || "[]");
    assert.strictEqual(failSteps[1].status, "FAILURE", "Step 2 must have failed");
    assert.strictEqual(failSteps[1].exitCode, 1, "Step 2 exitCode must be 1");
    assert.strictEqual(failSteps[2].status, "SKIPPED", "Step 3 must be SKIPPED");
    console.log(`✓ Failing step accurately caught: ${failSteps[1].name} failed with exit code 1`);
    console.log(`✓ Downstream step accurately skipped: ${failSteps[2].name}`);

    // Verify CommitStatus on failingCommitSha
    const failStatusReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/commits/${failingCommitSha}/statuses`, {
      method: "GET",
      headers: { "x-user-id": user.id },
    });
    const failStatuses = unwrap(await (await commitStatusesHandler(failStatusReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, sha: failingCommitSha }),
    })).json()).statuses;
    const failCiStatus = failStatuses.find((s) => s.context === "klyro-ci / Linter & Tests");
    assert(failCiStatus, "CommitStatus for failing workflow must exist");
    assert.strictEqual(failCiStatus.state, "FAILURE", "CommitStatus must be FAILURE");
    console.log(`✓ CommitStatus verified on ${failingCommitSha.slice(0, 7)}: state=FAILURE`);

    // Open a Pull Request from feature/failing-checks -> main
    const prReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/pulls`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({
        title: "Test PR with Failing CI",
        headBranch: "feature/failing-checks",
        baseBranch: "main",
      }),
    });
    const prRes = await createPrHandler(prReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(prRes.status, 201, "PR should be created");
    const pr = unwrap(await prRes.json()).pullRequest;

    // Protect main branch by requiring status checks
    await prisma.branchProtectionRule.create({
      data: {
        repositoryId: repository.id,
        pattern: "main",
        requireStatusChecks: true,
      },
    });

    // Check PR Merge Gates
    const gatesReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/pulls/${pr.number}/gates`, {
      method: "GET",
      headers: { "x-user-id": user.id },
    });
    const gatesRes = await prGatesHandler(gatesReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, number: String(pr.number) }),
    });
    assert.strictEqual(gatesRes.status, 200);
    const gatesData = unwrap(await gatesRes.json());
    const statusGate = gatesData.gates.find((g) => g.id === "status_checks");
    assert(statusGate, "status_checks gate must exist in gates list");
    assert.strictEqual(statusGate.status, "FAILED", "status_checks gate must have status FAILED");
    assert.strictEqual(gatesData.canMerge, false, "PR must be blocked from merging when CI fails");
    console.log("✓ PR Merge Gate successfully blocked merge due to CI failure!");

    // ==========================================
    // TEST 4: Single Run Detail & Cancellation
    // ==========================================
    console.log("\n--- TEST 4: Run Detail & Cancellation ---");
    // Query run detail
    const detailReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/actions/${run1.id}`, {
      method: "GET",
      headers: { "x-user-id": user.id },
    });
    const detailRes = await actionDetailHandler(detailReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, runId: run1.id }),
    });
    assert.strictEqual(detailRes.status, 200);
    const detailRun = unwrap(await detailRes.json()).run;
    assert.strictEqual(detailRun.id, run1.id);
    console.log(`✓ Retrieved run details by ID (${detailRun.id}): status=${detailRun.status}`);

    // Create a run in QUEUED state and cancel it
    const queuedRun = await prisma.repositoryActionRun.create({
      data: {
        repositoryId: repository.id,
        workflowName: "Long Running Pipeline",
        commitSha,
        branch: "main",
        event: "manual_dispatch",
        status: "QUEUED",
        logs: "Waiting for runner...\n",
      },
    });

    const cancelReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/actions/${queuedRun.id}`, {
      method: "POST",
      headers: { "x-user-id": user.id },
    });
    const cancelRes = await actionCancelHandler(cancelReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, runId: queuedRun.id }),
    });
    assert.strictEqual(cancelRes.status, 200);
    const cancelledRun = unwrap(await cancelRes.json()).run;
    assert.strictEqual(cancelledRun.status, "CANCELLED");
    assert.strictEqual(cancelledRun.conclusion, "CANCELLED");
    console.log("✓ Action run cancellation confirmed: status=CANCELLED");

    console.log("\n=======================================================");
    console.log("🎉 ALL FEATURE 10 CI/CD ACTION RUNNER TESTS PASSED! 🎉");
    console.log("=======================================================\n");
  } finally {
    try {
      if (repository) {
        await prisma.repositoryActionRun.deleteMany({ where: { repositoryId: repository.id } });
        await prisma.commitStatus.deleteMany({ where: { repositoryId: repository.id } });
        await prisma.pullRequest.deleteMany({ where: { repositoryId: repository.id } });
        await prisma.repository.deleteMany({ where: { id: repository.id } });
        await fs.rm(storagePath, { recursive: true, force: true }).catch(() => {});
      }
      if (user) {
        await prisma.user.deleteMany({ where: { id: user.id } });
      }
    } catch (cleanErr) {
      console.warn("Cleanup warning:", cleanErr.message);
    }
  }
}

runTests().catch((err) => {
  console.error("FATAL TEST FAILURE:", err);
  process.exit(1);
});
