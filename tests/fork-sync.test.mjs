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
import { POST as forkHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/fork/route.ts";
import {
  GET as syncForkGetHandler,
  POST as syncForkPostHandler,
} from "../src/app/api/v1/repositories/[owner]/[repo]/sync-fork/route.ts";

function getSyncStatus(json) {
  return json.syncStatus || json.data?.syncStatus || json;
}

function getSyncResult(json) {
  return json.modeUsed ? json : (json.data || json);
}

async function runTests() {
  console.log("=== Feature 9: Fork Synchronization (Sync Fork) Integration Tests ===\n");

  const timestamp = Date.now();
  const aliceUsername = `alice_sync_${timestamp}`;
  const bobUsername = `bob_sync_${timestamp}`;
  const repoSlug = `repo-sync-${timestamp}`;

  let alice;
  let bob;
  let upstreamRepo;
  let forkedRepo;
  const upstreamStorage = path.join(os.tmpdir(), `klyro_test_upstream_${timestamp}.git`);

  try {
    // 1. Setup Users
    alice = await prisma.user.create({
      data: {
        email: `${aliceUsername}@klyro.test`,
        username: aliceUsername,
        displayName: "Alice Upstream",
      },
    });

    bob = await prisma.user.create({
      data: {
        email: `${bobUsername}@klyro.test`,
        username: bobUsername,
        displayName: "Bob Forker",
      },
    });

    // 2. Setup Upstream Repository
    upstreamRepo = await prisma.repository.create({
      data: {
        ownerId: alice.id,
        name: repoSlug,
        slug: repoSlug,
        defaultBranch: "main",
        visibility: "PUBLIC",
        gitStoragePath: upstreamStorage,
      },
    });

    await initBareRepo(upstreamStorage, "main");
    await seedInitialCommit(upstreamStorage, {
      defaultBranch: "main",
      files: [{ path: "README.md", content: "# Upstream Core Library\n" }],
      message: "Initial commit on upstream",
      author: { name: "Alice", email: "alice@klyro.test" },
    });
    console.log("✓ Initialized upstream bare repository with base commit");

    // 3. Fork Upstream Repository for Bob
    const forkReq = new Request(`http://localhost/api/v1/repositories/${aliceUsername}/${repoSlug}/fork`, {
      method: "POST",
      headers: { "x-user-id": bob.id },
    });
    const forkRes = await forkHandler(forkReq, {
      params: Promise.resolve({ owner: aliceUsername, repo: repoSlug }),
    });
    assert.strictEqual(forkRes.status, 201, "Fork should return 201 Created");
    const forkData = await forkRes.json();
    const createdFork = forkData.repository ? forkData.repository : forkData.data.repository;
    forkedRepo = createdFork;
    assert.strictEqual(forkedRepo.ownerId, bob.id, "Fork owner must be Bob");
    assert.strictEqual(forkedRepo.forkedFromId, upstreamRepo.id, "ForkedFromId must match upstream ID");
    console.log("✓ Successfully created fork for Bob with bare clone");

    // ==========================================
    // TEST 1: Initial Fork Sync Status
    // ==========================================
    console.log("\n--- TEST 1: Verify Initial Up-To-Date Fork Sync Status ---");
    const status1Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const status1Res = await syncForkGetHandler(status1Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    });
    assert.strictEqual(status1Res.status, 200, "sync-fork GET should return 200");
    const status1Data = await status1Res.json();
    const s1 = status1Data.syncStatus || status1Data.data?.syncStatus;
    assert.strictEqual(s1.isUpToDate, true, "Fork should initially be up to date");
    assert.strictEqual(s1.ahead, 0, "Fork should have 0 commits ahead");
    assert.strictEqual(s1.behind, 0, "Fork should have 0 commits behind");
    assert.strictEqual(s1.canFastForward, false, "canFastForward should be false when up to date");
    console.log("✓ Fork sync status correctly reports isUpToDate: true (0 ahead, 0 behind)");

    // ==========================================
    // TEST 2: Upstream Divergence & Fast-Forward Sync
    // ==========================================
    console.log("\n--- TEST 2: Upstream Divergence & Fast-Forward Sync (AUTO mode) ---");
    // Alice adds a commit to upstream main
    await createCommitOnBranch(upstreamStorage, {
      branch: "main",
      message: "feat: add vector database client",
      files: [{ path: "src/vector.ts", content: "export const query = () => [];\n" }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });

    // Check status on Bob's fork
    const status2Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const status2Res = await syncForkGetHandler(status2Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    });
    const status2Data = await status2Res.json();
    const s2 = status2Data.syncStatus || status2Data.data?.syncStatus;
    assert.strictEqual(s2.isUpToDate, false, "Fork should no longer be up to date");
    assert.strictEqual(s2.ahead, 0, "Fork should still have 0 commits ahead");
    assert.strictEqual(s2.behind, 1, "Fork should be 1 commit behind upstream");
    assert.strictEqual(s2.canFastForward, true, "canFastForward should be true");
    console.log(`✓ Upstream divergence detected: 0 ahead, ${s2.behind} behind, canFastForward: true`);

    // Synchronize fork via AUTO (triggers FAST_FORWARD)
    const sync1Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": bob.id },
      body: JSON.stringify({ branch: "main", mode: "AUTO" }),
    });
    const sync1Res = await syncForkPostHandler(sync1Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    });
    assert.strictEqual(sync1Res.status, 200, "sync-fork POST should return 200");
    const sync1Data = await sync1Res.json();
    const res1 = sync1Data.modeUsed ? sync1Data : sync1Data.data;
    assert.strictEqual(res1.success, true, "Sync should succeed");
    assert.strictEqual(res1.modeUsed, "FAST_FORWARD", "Mode used should be FAST_FORWARD");
    console.log("✓ Fast-forward sync executed successfully: " + res1.message);

    // Verify Bob's fork is up to date now
    const status2PostReq = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const status2PostRes = await syncForkGetHandler(status2PostReq, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    });
    const s2Post = getSyncStatus(await status2PostRes.json());
    assert.strictEqual(s2Post.isUpToDate, true, "Fork must be up to date after fast-forward");
    assert.strictEqual(s2Post.ahead, 0);
    assert.strictEqual(s2Post.behind, 0);
    console.log("✓ Post-sync check confirmed fork is now up to date");

    // ==========================================
    // TEST 3: Divergence & 3-Way Merge Sync
    // ==========================================
    console.log("\n--- TEST 3: Divergent Commits & 3-Way Merge Commit Sync (MERGE mode) ---");
    // Alice adds a commit to upstream main
    await createCommitOnBranch(upstreamStorage, {
      branch: "main",
      message: "feat: add telemetry metrics exporter",
      files: [{ path: "src/metrics.ts", content: "export const record = () => {};\n" }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });

    // Bob adds an independent commit to his fork main
    await createCommitOnBranch(forkedRepo.gitStoragePath, {
      branch: "main",
      message: "feat: add local experimental caching layer",
      files: [{ path: "src/cache.ts", content: "export const cache = new Map();\n" }],
      author: { name: "Bob", email: "bob@klyro.test" },
    });

    // Check divergence status
    const status3Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const s3 = getSyncStatus(await (await syncForkGetHandler(status3Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    })).json());

    assert.strictEqual(s3.ahead, 1, "Fork should be 1 commit ahead");
    assert.strictEqual(s3.behind, 1, "Fork should be 1 commit behind");
    assert.strictEqual(s3.canFastForward, false, "Cannot fast-forward when ahead > 0");
    assert.strictEqual(s3.hasConflicts, false, "No conflicts expected between distinct files");
    console.log(`✓ Both repos diverged: ${s3.ahead} ahead, ${s3.behind} behind, conflicts: ${s3.hasConflicts}`);

    // Execute 3-way merge sync
    const sync2Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": bob.id },
      body: JSON.stringify({ branch: "main", mode: "MERGE" }),
    });
    const sync2Res = await syncForkPostHandler(sync2Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    });
    assert.strictEqual(sync2Res.status, 200, "Merge sync should return 200");
    const res2 = getSyncResult(await sync2Res.json());
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.modeUsed, "MERGE", "Mode used should be MERGE");
    assert(res2.commitSha, "Merge commit SHA must be returned");
    console.log(`✓ 3-way merge commit created: ${res2.commitSha.slice(0, 7)} - ${res2.message}`);

    // Verify Bob's fork now has behind === 0
    const status3PostReq = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const s3Post = getSyncStatus(await (await syncForkGetHandler(status3PostReq, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    })).json());
    assert.strictEqual(s3Post.behind, 0, "Fork behind count must be 0 after merge");
    console.log("✓ Post-merge check confirmed fork is no longer behind upstream");

    // ==========================================
    // TEST 4: Discard Local Commits Mode
    // ==========================================
    console.log("\n--- TEST 4: Discard Local Commits Mode (DISCARD mode) ---");
    // Bob adds another commit he wants to throw away
    await createCommitOnBranch(forkedRepo.gitStoragePath, {
      branch: "main",
      message: "wip: broken experimental prototype",
      files: [{ path: "src/broken.ts", content: "throw new Error();\n" }],
      author: { name: "Bob", email: "bob@klyro.test" },
    });

    // Alice also commits upstream
    await createCommitOnBranch(upstreamStorage, {
      branch: "main",
      message: "feat: add production health check endpoint",
      files: [{ path: "src/health.ts", content: "export const health = () => 200;\n" }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });

    // Check status: fork is ahead and behind
    const status4Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const s4 = getSyncStatus(await (await syncForkGetHandler(status4Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    })).json());
    assert(s4.ahead >= 1, "Fork should be ahead");
    assert(s4.behind >= 1, "Fork should be behind");
    console.log(`✓ Status before discard: ${s4.ahead} ahead, ${s4.behind} behind`);

    // Execute DISCARD
    const sync3Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": bob.id },
      body: JSON.stringify({ branch: "main", mode: "DISCARD" }),
    });
    const sync3Res = await syncForkPostHandler(sync3Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    });
    assert.strictEqual(sync3Res.status, 200, "Discard sync should return 200");
    const res3 = getSyncResult(await sync3Res.json());
    assert.strictEqual(res3.modeUsed, "DISCARD");
    console.log("✓ Discard mode executed: " + res3.message);

    // Verify Bob's fork now exactly matches upstream
    const status4PostReq = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const s4Post = getSyncStatus(await (await syncForkGetHandler(status4PostReq, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    })).json());
    assert.strictEqual(s4Post.isUpToDate, true, "Fork should be strictly up to date after discard");
    assert.strictEqual(s4Post.ahead, 0, "Fork ahead must be 0 after discard");
    assert.strictEqual(s4Post.behind, 0, "Fork behind must be 0 after discard");
    console.log("✓ Fork ref is now hard-reset to upstream commit");

    // ==========================================
    // TEST 5: Conflict Detection & Safety Halt
    // ==========================================
    console.log("\n--- TEST 5: Conflict Detection & Safety Halt on Merge ---");
    // Upstream modifies conflicting.txt
    await createCommitOnBranch(upstreamStorage, {
      branch: "main",
      message: "upstream conflicting change",
      files: [{ path: "conflicting.txt", content: "LINE 1: UPSTREAM EDITION\nLINE 2: UPSTREAM DETAILS\n" }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });

    // Fork modifies conflicting.txt in an incompatible way
    await createCommitOnBranch(forkedRepo.gitStoragePath, {
      branch: "main",
      message: "fork conflicting change",
      files: [{ path: "conflicting.txt", content: "LINE 1: FORK EDITION\nLINE 2: FORK DETAILS\n" }],
      author: { name: "Bob", email: "bob@klyro.test" },
    });

    // GET sync-fork should flag hasConflicts: true
    const status5Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork?branch=main`, {
      method: "GET",
      headers: { "x-user-id": bob.id },
    });
    const s5 = getSyncStatus(await (await syncForkGetHandler(status5Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    })).json());
    assert.strictEqual(s5.hasConflicts, true, "hasConflicts must be true when files conflict");
    console.log("✓ Conflict accurately detected by merge-tree: hasConflicts === true");

    // Attempting MERGE mode should fail with 400
    const sync5Req = new Request(`http://localhost/api/v1/repositories/${bobUsername}/${repoSlug}/sync-fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": bob.id },
      body: JSON.stringify({ branch: "main", mode: "MERGE" }),
    });
    const sync5Res = await syncForkPostHandler(sync5Req, {
      params: Promise.resolve({ owner: bobUsername, repo: repoSlug }),
    });
    assert.strictEqual(sync5Res.status, 400, "Merge attempt on conflicting branches must return 400");
    const sync5Err = await sync5Res.json();
    assert(
      sync5Err.error?.message?.includes("conflict") || sync5Err.error?.includes("conflict"),
      "Error message must specify conflicts"
    );
    console.log("✓ Safety halt confirmed: Merge blocked with conflict error message");

    console.log("\n=======================================================");
    console.log("🎉 ALL FEATURE 9 FORK SYNCHRONIZATION TESTS PASSED! 🎉");
    console.log("=======================================================\n");
  } finally {
    // Cleanup
    try {
      if (forkedRepo) {
        await prisma.repository.deleteMany({ where: { id: forkedRepo.id } });
        if (forkedRepo.gitStoragePath) {
          await fs.rm(forkedRepo.gitStoragePath, { recursive: true, force: true }).catch(() => {});
        }
      }
      if (upstreamRepo) {
        await prisma.repository.deleteMany({ where: { id: upstreamRepo.id } });
        await fs.rm(upstreamStorage, { recursive: true, force: true }).catch(() => {});
      }
      if (bob) {
        await prisma.user.deleteMany({ where: { id: bob.id } });
      }
      if (alice) {
        await prisma.user.deleteMany({ where: { id: alice.id } });
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
