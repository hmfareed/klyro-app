import assert from "node:assert";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  initBareRepo,
  seedInitialCommit,
  createBranch,
  createCommitOnBranch,
  createTag,
  mergeBranches,
  getBranches,
} from "../src/server/git/git-service.ts";
import { buildCommitGraph } from "../src/server/git/graph/commit-graph-service.ts";
import { GET as networkHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/network/route.ts";
import { GET as branchesHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/branches/route.ts";

async function runTests() {
  console.log("=== Feature 7: Commit Graph & Visual Network Tree Integration Tests ===\n");

  const timestamp = Date.now();
  const username = `graphuser_${timestamp}`;
  const repoSlug = `repo-graph-${timestamp}`;

  let user;
  let repository;
  const storagePath = path.join(os.tmpdir(), `klyro_test_graph_${timestamp}.git`);

  try {
    // 1. Setup User & Repository
    user = await prisma.user.create({
      data: {
        email: `${username}@klyro.test`,
        username,
        displayName: "Graph Test User",
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
      include: {
        owner: true,
      },
    });

    // 2. Initialize Bare Git Repo & Seed Commits
    await initBareRepo(storagePath, "main");
    const initSha = await seedInitialCommit(storagePath, {
      defaultBranch: "main",
      files: [{ path: "README.md", content: "# Graph Test Repo\n" }],
      message: "Initial commit",
      author: { name: "Graph User", email: "graph@klyro.test" },
    });
    console.log("✓ Initialized bare repo with initial commit:", initSha.slice(0, 7));

    // 3. Create 'feature/alpha' and add 2 commits
    await createBranch(storagePath, "feature/alpha", "main");
    const alpha1 = await createCommitOnBranch(storagePath, {
      branch: "feature/alpha",
      message: "feat(alpha): initial alpha implementation",
      files: [{ path: "alpha.ts", content: "export const alpha = 1;\n" }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });
    const alpha2 = await createCommitOnBranch(storagePath, {
      branch: "feature/alpha",
      message: "feat(alpha): complete alpha logic",
      files: [{ path: "alpha.ts", content: "export const alpha = 2;\n" }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });
    console.log("✓ Added 2 commits on feature/alpha:", alpha1.commitSha.slice(0, 7), alpha2.commitSha.slice(0, 7));

    // 4. Create concurrent commit on 'main' (causing divergence)
    const mainUpdate = await createCommitOnBranch(storagePath, {
      branch: "main",
      message: "docs: update main readme",
      files: [{ path: "README.md", content: "# Graph Test Repo\n\nMain branch updates.\n" }],
      author: { name: "Bob", email: "bob@klyro.test" },
    });
    console.log("✓ Added concurrent commit on main:", mainUpdate.commitSha.slice(0, 7));

    // 5. Create 'feature/beta' from main and add 1 commit
    await createBranch(storagePath, "feature/beta", "main");
    const beta1 = await createCommitOnBranch(storagePath, {
      branch: "feature/beta",
      message: "feat(beta): introduce beta service",
      files: [{ path: "beta.ts", content: "export const beta = 'ready';\n" }],
      author: { name: "Charlie", email: "charlie@klyro.test" },
    });
    console.log("✓ Added commit on feature/beta:", beta1.commitSha.slice(0, 7));

    // 6. Merge 'feature/alpha' into 'main' with merge commit (2 parents)
    const mergeRes = await mergeBranches(
      storagePath,
      "main",
      "feature/alpha",
      "Merge pull request #1 from feature/alpha into main",
      { name: "Maintainer", email: "maintainer@klyro.test" }
    );
    assert(mergeRes.success && mergeRes.commitSha, "Merge must succeed");
    const mergeCommitSha = mergeRes.commitSha;
    console.log("✓ Merged feature/alpha into main (Merge commit SHA):", mergeCommitSha.slice(0, 7));

    // 7. Create tag v1.0.0 on main
    await createTag(storagePath, "v1.0.0", "main", "Release version 1.0.0");
    console.log("✓ Created tag v1.0.0 on main");

    console.log("\n--- TEST 1: Ahead/Behind Divergence Calculations ---");
    const branchesWithDivergence = await getBranches(storagePath, "main", true);
    console.log("Branches found:", branchesWithDivergence.map(b => `${b.name} (ahead: ${b.ahead}, behind: ${b.behind})`));

    const mainBranch = branchesWithDivergence.find(b => b.name === "main");
    assert(mainBranch, "main branch must exist");
    assert.strictEqual(mainBranch.isDefault, true);
    assert.strictEqual(mainBranch.ahead, 0);
    assert.strictEqual(mainBranch.behind, 0);
    assert(mainBranch.lastCommit, "main branch must have lastCommit metadata");

    const betaBranch = branchesWithDivergence.find(b => b.name === "feature/beta");
    assert(betaBranch, "feature/beta branch must exist");
    assert.strictEqual(betaBranch.isDefault, false);
    assert.strictEqual(betaBranch.ahead, 1, "feature/beta should be 1 commit ahead of main's ancestor");
    assert(typeof betaBranch.behind === "number" && betaBranch.behind > 0, "feature/beta should be behind main");
    console.log(`✓ feature/beta divergence verified: ↑ ${betaBranch.ahead} ahead · ↓ ${betaBranch.behind} behind`);

    console.log("\n--- TEST 2: GET /branches REST API Route ---");
    const branchesReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/branches`, {
      headers: { "x-user-id": user.id },
    });
    const branchesRes = await branchesHandler(branchesReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(branchesRes.status, 200);
    const branchesData = await branchesRes.json();
    const apiBranches = branchesData.branches || branchesData.data?.branches;
    assert(Array.isArray(apiBranches), "API must return branches array");
    const apiBeta = apiBranches.find(b => b.name === "feature/beta");
    assert(apiBeta && apiBeta.ahead === 1, "API must include divergence metrics for feature/beta");
    console.log("✓ GET /branches REST API returned enriched branches with ahead/behind metrics!");

    console.log("\n--- TEST 3: Topological Commit Graph DAG Generation ---");
    const graphResult = await buildCommitGraph(storagePath, { ref: "all", limit: 50 });

    assert(graphResult.nodes.length >= 6, `Expected at least 6 commits, got ${graphResult.nodes.length}`);
    console.log(`✓ Graph nodes count: ${graphResult.nodes.length}`);
    console.log(`✓ Graph total visual lanes: ${graphResult.totalLanes}`);
    assert(graphResult.totalLanes >= 2, `Expected at least 2 concurrent lanes, got ${graphResult.totalLanes}`);

    // Verify merge commit has 2 parents
    const mergeNode = graphResult.nodes.find(n => n.sha === mergeCommitSha);
    assert(mergeNode, "Merge commit must be present in nodes");
    assert.strictEqual(mergeNode.parents.length, 2, "Merge node must have exactly 2 parents");
    console.log(`✓ Merge commit verified: ${mergeNode.shortSha} with 2 parents:`, mergeNode.parents.map(p => p.slice(0, 7)));

    // Verify edge links
    assert(graphResult.links.length > 0, "Links array must not be empty");
    const mergeLinks = graphResult.links.filter(l => l.fromSha === mergeCommitSha);
    assert.strictEqual(mergeLinks.length, 2, "Merge commit must have 2 outgoing parent links");
    console.log("✓ Merge commit has 2 outgoing parent edges in SVG graph");

    // Verify bezier curve path generation
    const bezierLink = graphResult.links.find(l => l.pathD.includes("C "));
    assert(bezierLink, "Expected at least one smooth bezier curve for lane branching/merging");
    console.log("✓ Smooth cubic bezier curve generated for cross-lane edge:", bezierLink.pathD);

    // Verify refs parsing
    assert(graphResult.branches.includes("main"), "branches list must include main");
    assert(graphResult.branches.includes("feature/beta"), "branches list must include feature/beta");
    assert(graphResult.tags.includes("v1.0.0"), "tags list must include v1.0.0");
    console.log("✓ Graph refs extracted: branches:", graphResult.branches, "tags:", graphResult.tags);

    // Verify node tags and branch decorations
    const taggedNode = graphResult.nodes.find(n => n.refs.tags.includes("v1.0.0"));
    assert(taggedNode, "Node with tag v1.0.0 must exist");
    console.log(`✓ Node ${taggedNode.shortSha} has tag badge:`, taggedNode.refs.tags);

    console.log("\n--- TEST 4: GET /network REST API Route ---");
    const networkReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/network?ref=all`, {
      headers: { "x-user-id": user.id },
    });
    const networkRes = await networkHandler(networkReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(networkRes.status, 200);
    const networkData = await networkRes.json();
    const apiNodes = networkData.nodes || networkData.data?.nodes;
    const apiLinks = networkData.links || networkData.data?.links;
    assert(Array.isArray(apiNodes) && apiNodes.length >= 6, "API must return nodes array");
    assert(Array.isArray(apiLinks) && apiLinks.length > 0, "API must return links array");
    console.log(`✓ GET /network REST API verified: ${apiNodes.length} nodes, ${apiLinks.length} links!`);

    console.log("\n--- TEST 5: Branch-Filtered Commit Graph Query ---");
    const betaGraph = await buildCommitGraph(storagePath, { ref: "feature/beta" });
    assert(betaGraph.nodes.length > 0, "feature/beta filtered graph must return commits");
    const hasBetaCommit = betaGraph.nodes.some(n => n.sha === beta1.commitSha);
    assert(hasBetaCommit, "feature/beta graph must contain beta1 commit");
    console.log(`✓ Filtered graph for feature/beta returned ${betaGraph.nodes.length} commits including beta1`);

    console.log("\n=======================================================");
    console.log("ALL FEATURE 7 COMMIT GRAPH & NETWORK TESTS PASSED 100%!");
    console.log("=======================================================");
  } finally {
    // Cleanup
    if (repository) {
      await prisma.repository.delete({ where: { id: repository.id } }).catch(() => {});
    }
    if (user) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
    await fs.rm(storagePath, { recursive: true, force: true }).catch(() => {});
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
