import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/index.js";
import {
  initBareRepo,
  seedInitialCommit,
  getRepoStoragePath,
} from "../src/server/git/git-service.ts";
import { scanRepoForSecrets } from "../src/server/repositories/secret-scanner.ts";
import {
  changeRepositoryVisibility,
  setRepositoryArchiveState,
  scheduleRepositoryDeletion,
  restoreRepository,
  purgeRepositoryPermanently,
} from "../src/server/repositories/repo-lifecycle.ts";
import { getRepositoryWithAccess } from "../src/server/repositories/repo-access.ts";
import fs from "node:fs/promises";

const prisma = new PrismaClient();

async function runRepoChangesLifecycleTest() {
  console.log("=== KLYRO REPOSITORY CHANGES FLOW & LIFECYCLE TEST ===\n");

  // 1. Get test user
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found in database");
  console.log(`1. Test User: ${user.username} (${user.id})`);

  // 2. Create test repository
  const repoName = `lifecycle-repo-${Date.now()}`;
  const slug = repoName;

  const repo = await prisma.repository.create({
    data: {
      ownerId: user.id,
      name: repoName,
      slug,
      description: "Lifecycle & Changes test repository",
      visibility: "PRIVATE",
      defaultBranch: "main",
      gitStoragePath: "",
    },
    include: {
      owner: { select: { id: true, username: true } },
    },
  });

  const storagePath = getRepoStoragePath(repo.id);
  await initBareRepo(storagePath, "main");

  // Seed commit with an env file and an AWS key to test secret scanner
  await seedInitialCommit(storagePath, {
    defaultBranch: "main",
    files: [
      {
        path: "README.md",
        content: "# Test Project\nTesting repo changes flow.\n",
      },
      {
        path: ".env.local",
        content: "DATABASE_URL=postgres://admin:supersecret@db.klyro.internal/prod\n",
      },
      {
        path: "config/aws.ts",
        content: "export const awsKey = 'AKIAIOSFODNN7EXAMPLE';\n",
      },
    ],
    message: "Initial commit with config",
    author: { name: user.username, email: "tester@klyro.dev" },
  });

  repo.gitStoragePath = storagePath;
  await prisma.repository.update({
    where: { id: repo.id },
    data: { gitStoragePath: storagePath },
  });
  console.log(`2. Repository created & seeded at ${storagePath}`);

  // 3. Test Pre-flight Secret Scanner
  console.log("\n3. Testing Pre-flight Secret Scanner...");
  const scanResult = await scanRepoForSecrets(storagePath, "main");
  console.log(`   Scanned files: ${scanResult.totalFilesScanned}`);
  console.log(`   Has warnings: ${scanResult.hasWarnings}`);
  console.log(`   Findings count: ${scanResult.findings.length}`);
  if (!scanResult.hasWarnings || scanResult.findings.length < 2) {
    throw new Error("Secret scanner failed to detect .env.local or AWS key");
  }
  for (const f of scanResult.findings) {
    console.log(`   ✓ Found ${f.rule} in ${f.path}: ${f.preview}`);
  }

  // 4. Test Visibility Change Guard (PRIVATE -> PUBLIC)
  console.log("\n4. Testing Visibility Guard (Secrets Protection)...");
  const rejectedAttempt = await changeRepositoryVisibility({
    repository: repo,
    actorId: user.id,
    newVisibility: "PUBLIC",
    forceWithWarnings: false,
  });

  if (rejectedAttempt.success || rejectedAttempt.code !== "SECRETS_DETECTED") {
    throw new Error("Visibility change should have been rejected due to detected secrets");
  }
  console.log("   ✓ Visibility change blocked with SECRETS_DETECTED warning");

  // 5. Test Visibility Override with Acknowledged Warnings
  console.log("\n5. Testing Visibility Override with forceWithWarnings...");
  const approvedAttempt = await changeRepositoryVisibility({
    repository: repo,
    actorId: user.id,
    newVisibility: "PUBLIC",
    forceWithWarnings: true,
  });

  if (!approvedAttempt.success || approvedAttempt.repository.visibility !== "PUBLIC") {
    throw new Error("Failed to change visibility with forceWithWarnings: true");
  }
  console.log("   ✓ Repository visibility successfully switched to PUBLIC");

  // 6. Test Switch back to PRIVATE
  console.log("\n6. Testing Switch to PRIVATE & Access Protection...");
  const privateAttempt = await changeRepositoryVisibility({
    repository: approvedAttempt.repository,
    actorId: user.id,
    newVisibility: "PRIVATE",
  });
  if (!privateAttempt.success || privateAttempt.repository.visibility !== "PRIVATE") {
    throw new Error("Failed to switch repository visibility back to PRIVATE");
  }

  // Verify access for random stranger (unauthenticated)
  const strangerAccess = await getRepositoryWithAccess(user.username, slug, null);
  if (strangerAccess?.viewer.canRead !== false) {
    throw new Error("Stranger should not have read access to PRIVATE repository");
  }
  console.log("   ✓ Repository switched to PRIVATE, stranger canRead is FALSE (404 Not Found guard)");

  // 7. Test Archive / Unarchive Workflow
  console.log("\n7. Testing Archive Workflow...");
  const archiveResult = await setRepositoryArchiveState({
    repository: privateAttempt.repository,
    actorId: user.id,
    archived: true,
  });
  if (!archiveResult.success || !archiveResult.repository.archived || archiveResult.repository.status !== "ARCHIVED") {
    throw new Error("Failed to archive repository");
  }

  // Verify read-only lock in access service
  const archivedAccess = await getRepositoryWithAccess(user.username, slug, user.id);
  if (archivedAccess?.viewer.canWrite !== false) {
    throw new Error("Archived repository must have canWrite === false (read-only lock)");
  }
  console.log("   ✓ Repository archived. status=ARCHIVED, write access locked (canWrite=false)");

  // Unarchive
  const unarchiveResult = await setRepositoryArchiveState({
    repository: archiveResult.repository,
    actorId: user.id,
    archived: false,
  });
  if (!unarchiveResult.success || unarchiveResult.repository.archived || unarchiveResult.repository.status !== "ACTIVE") {
    throw new Error("Failed to unarchive repository");
  }
  console.log("   ✓ Repository unarchived. status=ACTIVE, full read-write restored");

  // 8. Test Deliberate Soft-Deletion & 30-Day Retention
  console.log("\n8. Testing Deliberate Soft-Deletion & 30-Day Retention...");
  // Test wrong confirmation name
  const invalidDelete = await scheduleRepositoryDeletion({
    repository: unarchiveResult.repository,
    actorId: user.id,
    confirmationName: "wrong-name",
  });
  if (invalidDelete.success) {
    throw new Error("scheduleRepositoryDeletion should reject mismatched confirmation name");
  }
  console.log("   ✓ Mismatched confirmation name correctly rejected");

  // Schedule soft deletion
  const validDelete = await scheduleRepositoryDeletion({
    repository: unarchiveResult.repository,
    actorId: user.id,
    confirmationName: repoName,
    retentionDays: 30,
  });
  if (!validDelete.success || validDelete.repository.status !== "DELETION_PENDING") {
    throw new Error("Failed to schedule repository deletion");
  }
  console.log(`   ✓ Repository status set to DELETION_PENDING, daysRemaining=${validDelete.daysRemaining}`);
  console.log(`   ✓ Purge date set to: ${validDelete.purgeAt.toISOString()}`);

  // Verify bare Git repository is STILL PRESERVED on disk!
  const stat = await fs.stat(storagePath);
  if (!stat.isDirectory()) {
    throw new Error("Bare Git directory was erroneously deleted during soft deletion!");
  }
  console.log("   ✓ Verified physical Git repository is preserved on disk during retention period");

  // Verify access protection during DELETION_PENDING:
  // Stranger lookup returns null (404)
  const strangerDeletionAccess = await getRepositoryWithAccess(user.username, slug, null);
  if (strangerDeletionAccess !== null) {
    throw new Error("Stranger should receive null (404) for repository in DELETION_PENDING");
  }
  // Owner lookup succeeds so owner can see restore banner
  const ownerDeletionAccess = await getRepositoryWithAccess(user.username, slug, user.id);
  if (!ownerDeletionAccess || ownerDeletionAccess.repository.status !== "DELETION_PENDING") {
    throw new Error("Owner should be able to view repository in DELETION_PENDING to restore it");
  }
  console.log("   ✓ Deletion pending repo is hidden from strangers (404) but visible to owner for recovery");

  // 9. Test Repository Restoration
  console.log("\n9. Testing Repository Restoration...");
  const restoreResult = await restoreRepository({
    repository: validDelete.repository,
    actorId: user.id,
  });
  if (!restoreResult.success || restoreResult.repository.status !== "ACTIVE" || restoreResult.repository.purgeAt !== null) {
    throw new Error("Failed to restore repository from DELETION_PENDING");
  }
  console.log("   ✓ Repository successfully restored to ACTIVE, purgeAt cleared");

  // 10. Test Audit Log
  console.log("\n10. Testing Repository Audit Log...");
  const auditEvents = await prisma.repositoryAuditEvent.findMany({
    where: { repositoryId: repo.id },
    orderBy: { createdAt: "desc" },
  });
  console.log(`   Recorded audit events (${auditEvents.length}):`);
  for (const evt of auditEvents) {
    console.log(`   - [${evt.action}] ${evt.previousValue || ""} -> ${evt.newValue || ""}`);
  }
  if (auditEvents.length < 4) {
    throw new Error("Expected at least 4 audit events for visibility, archive, deletion, and restore");
  }
  console.log("   ✓ Verified complete chronological audit trail");

  // 11. Test Fork Tree Independence & Permanent Purge
  console.log("\n11. Testing Fork Independence & Permanent Purge...");
  // Create a child fork
  const childForkName = `child-fork-${Date.now()}`;
  const childFork = await prisma.repository.create({
    data: {
      ownerId: user.id,
      name: childForkName,
      slug: childForkName,
      visibility: "PUBLIC",
      defaultBranch: "main",
      gitStoragePath: "",
      forkedFromId: repo.id,
    },
  });
  console.log(`   ✓ Created child fork '${childFork.name}' linked to parent`);

  // Purge parent repository
  await purgeRepositoryPermanently({
    repository: { id: repo.id, gitStoragePath: storagePath },
    actorId: user.id,
  });

  // Verify physical directory is removed
  const dirExists = await fs.access(storagePath).then(() => true).catch(() => false);
  if (dirExists) {
    throw new Error("Permanent purge should remove physical Git storage from disk");
  }
  console.log("   ✓ Physical bare Git directory removed from disk");

  // Verify child fork survived and had forkedFromId safely detached!
  const updatedChildFork = await prisma.repository.findUnique({
    where: { id: childFork.id },
  });
  if (!updatedChildFork || updatedChildFork.forkedFromId !== null) {
    throw new Error("Child fork was deleted or failed to detach forkedFromId on parent purge!");
  }
  console.log("   ✓ Child fork survived parent purge and forkedFromId was safely detached");

  // Clean up child fork
  await prisma.repository.delete({ where: { id: childFork.id } });

  console.log("\n🎉 ALL REPOSITORY CHANGES & LIFECYCLE TESTS PASSED PERFECTLY!\n");
}

runRepoChangesLifecycleTest()
  .catch((err) => {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
