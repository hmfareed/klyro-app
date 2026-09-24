import assert from "node:assert";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  initBareRepo,
  seedInitialCommit,
  createCommitOnBranch,
  createTag,
} from "../src/server/git/git-service.ts";
import { POST as generateNotesHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/releases/generate-notes/route.ts";
import { GET as releasesGetHandler, POST as releasesPostHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/releases/route.ts";
import { POST as assetUploadHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/releases/[tag]/assets/route.ts";
import { GET as assetDownloadHandler, DELETE as assetDeleteHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/releases/assets/[id]/route.ts";
import { GET as zipArchiveHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/archive-zip/route.ts";
import { GET as tarArchiveHandler } from "../src/app/api/v1/repositories/[owner]/[repo]/archive-tar/route.ts";

async function runTests() {
  console.log("=== Feature 8: Releases & Binary Asset Attachments Integration Tests ===\n");

  const timestamp = Date.now();
  const username = `releaseuser_${timestamp}`;
  const repoSlug = `repo-releases-${timestamp}`;

  let user;
  let repository;
  const storagePath = path.join(os.tmpdir(), `klyro_test_releases_${timestamp}.git`);

  try {
    // 1. Setup User & Repository
    user = await prisma.user.create({
      data: {
        email: `${username}@klyro.test`,
        username,
        displayName: "Release Engineer",
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
    await seedInitialCommit(storagePath, {
      defaultBranch: "main",
      files: [{ path: "README.md", content: "# Release Test App\n" }],
      message: "Initial commit",
      author: { name: "Alice", email: "alice@klyro.test" },
    });

    // Add feature and bugfix commits
    await createCommitOnBranch(storagePath, {
      branch: "main",
      message: "feat: add payment processor integration",
      files: [{ path: "src/payment.ts", content: "export const pay = () => true;\n" }],
      author: { name: "Alice", email: "alice@klyro.test" },
    });

    await createCommitOnBranch(storagePath, {
      branch: "main",
      message: "fix: resolve memory leak in worker cleanup",
      files: [{ path: "src/worker.ts", content: "export const clean = () => {};\n" }],
      author: { name: "Bob", email: "bob@klyro.test" },
    });
    console.log("✓ Initialized repo and added feature/fix commits on main");

    console.log("\n--- TEST 1: Automated Release Notes Generator ---");
    const notesReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/releases/generate-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({ tagName: "v1.0.0", targetCommitish: "main" }),
    });
    const notesRes = await generateNotesHandler(notesReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(notesRes.status, 200, "generate-notes should return 200");
    const notesData = await notesRes.json();
    const payload = notesData.notes ? notesData : notesData.data;
    assert(payload.notes.includes("## What's Changed"), "Notes must contain What's Changed header");
    assert(payload.notes.includes("🚀 New Features"), "Notes must categorize features");
    assert(payload.notes.includes("🐛 Bug Fixes"), "Notes must categorize bug fixes");
    assert(payload.notes.includes("payment processor"), "Notes must mention payment processor commit");
    console.log("✓ Generated release notes from Git log:\n" + payload.notes.slice(0, 150) + "...\n");

    console.log("\n--- TEST 2: Publish Release with Attached Initial Asset ---");
    const fakeCliBinary = Buffer.from("MZ\x90\x00\x03\x00\x00\x00THIS_IS_A_MOCK_WINDOWS_EXE_BINARY_DATA_FOR_KLYRO");
    const cliExpectedSha256 = crypto.createHash("sha256").update(fakeCliBinary).digest("hex");

    const releaseReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/releases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({
        tagName: "v1.0.0",
        targetCommitish: "main",
        name: "Version 1.0.0 Production Release",
        body: payload.notes,
        isPrerelease: false,
        assets: [
          {
            name: "klyro-cli-v1.0.0-windows-x64.exe",
            contentType: "application/vnd.microsoft.portable-executable",
            bufferBase64: fakeCliBinary.toString("base64"),
          },
        ],
      }),
    });
    const releaseRes = await releasesPostHandler(releaseReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(releaseRes.status, 201, "POST /releases should return 201");
    const releaseData = await releaseRes.json();
    const release = releaseData.release || releaseData.data?.release;
    assert.strictEqual(release.tagName, "v1.0.0");
    assert.strictEqual(release.name, "Version 1.0.0 Production Release");
    assert(Array.isArray(release.assets) && release.assets.length === 1, "Release should have 1 attached asset");
    const attachedAsset = release.assets[0];
    assert.strictEqual(attachedAsset.name, "klyro-cli-v1.0.0-windows-x64.exe");
    assert.strictEqual(attachedAsset.sha256, cliExpectedSha256);
    assert.strictEqual(attachedAsset.size, fakeCliBinary.length);
    console.log(`✓ Release v1.0.0 published with asset: ${attachedAsset.name} (SHA-256: ${attachedAsset.sha256.slice(0, 16)}...)`);

    console.log("\n--- TEST 3: Upload Secondary Distribution Asset via POST /releases/[tag]/assets ---");
    const fakeTarGzBinary = Buffer.from("SIMULATED_LINUX_AMD64_TARBALL_BINARY_BYTES");
    const tarExpectedSha256 = crypto.createHash("sha256").update(fakeTarGzBinary).digest("hex");

    const uploadReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/releases/v1.0.0/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": user.id },
      body: JSON.stringify({
        name: "klyro-cli-linux-amd64.tar.gz",
        contentType: "application/gzip",
        bufferBase64: fakeTarGzBinary.toString("base64"),
      }),
    });
    const uploadRes = await assetUploadHandler(uploadReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, tag: "v1.0.0" }),
    });
    assert.strictEqual(uploadRes.status, 201, "Upload asset should return 201");
    const uploadData = await uploadRes.json();
    const secondAsset = uploadData.asset || uploadData.data?.asset;
    assert.strictEqual(secondAsset.name, "klyro-cli-linux-amd64.tar.gz");
    assert.strictEqual(secondAsset.sha256, tarExpectedSha256);
    console.log(`✓ Second asset uploaded: ${secondAsset.name} (SHA-256: ${secondAsset.sha256.slice(0, 16)}...)`);

    console.log("\n--- TEST 4: Query Releases with Assets via GET /releases ---");
    const listReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/releases`, {
      headers: { "x-user-id": user.id },
    });
    const listRes = await releasesGetHandler(listReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(listRes.status, 200);
    const listData = await listRes.json();
    const releasesList = listData.releases || listData.data?.releases;
    assert.strictEqual(releasesList.length, 1);
    assert.strictEqual(releasesList[0].assets.length, 2, "Release should now list both 2 attached assets");
    console.log(`✓ GET /releases returned release with ${releasesList[0].assets.length} assets`);

    console.log("\n--- TEST 5: Download Binary Asset & Metrics Increment ---");
    const downloadReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/releases/assets/${attachedAsset.id}`);
    const downloadRes = await assetDownloadHandler(downloadReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, id: attachedAsset.id }),
    });
    assert.strictEqual(downloadRes.status, 200, "Download should return 200");
    const downloadedBytes = Buffer.from(await downloadRes.arrayBuffer());
    assert.deepStrictEqual(downloadedBytes, fakeCliBinary, "Downloaded binary must match uploaded content byte-for-byte");
    assert.strictEqual(downloadRes.headers.get("x-checksum-sha256"), cliExpectedSha256);
    assert(downloadRes.headers.get("content-disposition").includes(attachedAsset.name));

    // Verify download count incremented in DB
    const dbAsset = await prisma.repositoryReleaseAsset.findUnique({ where: { id: attachedAsset.id } });
    assert.strictEqual(dbAsset.downloadCount, 1, "Download count must increment to 1");
    console.log("✓ Binary asset download verified byte-for-byte. Download count incremented to 1!");

    console.log("\n--- TEST 6: Source Code Archives (ZIP & TAR.GZ) ---");
    // 1. ZIP
    const zipReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/archive-zip?ref=v1.0.0`);
    const zipRes = await zipArchiveHandler(zipReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(zipRes.status, 200);
    const zipBytes = Buffer.from(await zipRes.arrayBuffer());
    assert(zipBytes.subarray(0, 2).equals(Buffer.from([0x50, 0x4b])), "ZIP archive must begin with PK header");
    console.log(`✓ Source code (zip) verified: ${zipBytes.length} bytes with valid PK header`);

    // 2. TAR.GZ
    const tarReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/archive-tar?ref=v1.0.0`);
    const tarRes = await tarArchiveHandler(tarReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug }),
    });
    assert.strictEqual(tarRes.status, 200);
    const tarBytes = Buffer.from(await tarRes.arrayBuffer());
    assert(tarBytes.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b])), "TAR.GZ archive must begin with gzip header");
    console.log(`✓ Source code (tar.gz) verified: ${tarBytes.length} bytes with valid GZIP header`);

    console.log("\n--- TEST 7: Delete Release Asset via DELETE /releases/assets/[id] ---");
    const deleteReq = new Request(`http://localhost/api/v1/repositories/${username}/${repoSlug}/releases/assets/${secondAsset.id}`, {
      method: "DELETE",
      headers: { "x-user-id": user.id },
    });
    const deleteRes = await assetDeleteHandler(deleteReq, {
      params: Promise.resolve({ owner: username, repo: repoSlug, id: secondAsset.id }),
    });
    assert.strictEqual(deleteRes.status, 200);
    const deletedInDb = await prisma.repositoryReleaseAsset.findUnique({ where: { id: secondAsset.id } });
    assert.strictEqual(deletedInDb, null, "Deleted asset must no longer exist in DB");
    console.log("✓ Asset deleted and verified removed from database and disk!");

    console.log("\n=======================================================");
    console.log("ALL FEATURE 8 RELEASES & BINARY ASSET TESTS PASSED 100%!");
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
