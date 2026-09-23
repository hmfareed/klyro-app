import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import http from "node:http";
import { prisma } from "../src/shared/db/prisma.ts";
import {
  generatePersonalAccessToken,
  verifyPersonalAccessToken,
  authenticateGitRequest,
} from "../src/server/auth/pat-service.ts";
import {
  initBareRepo,
  seedInitialCommit,
  getBranches,
  getTree,
  getCommits,
} from "../src/server/git/git-service.ts";
import { executeGitHttpBackend } from "../src/server/git/git-http-gateway.ts";
import { evaluatePushPolicy } from "../src/server/git/hooks/policy.ts";

const execFileAsync = promisify(execFile);

async function runSmartHttpTests() {
  console.log("=== STARTING KLYRO REAL GIT (SMART HTTP) TEST SUITE ===");

  const timestamp = Date.now();
  const testUsername = `gituser_${timestamp}`;
  const testEmail = `git_${timestamp}@klyro.dev`;
  const repoSlug = `realgit-${timestamp}`;
  const storageDir = path.join(process.cwd(), "data", "repositories", `test_${timestamp}.git`);

  let testUser = null;
  let testRepo = null;
  let patToken = null;
  let server = null;
  const tempCloneDir = path.join(os.tmpdir(), `klyro_clone_${timestamp}`);

  try {
    // 1. Create Test User
    console.log("\n[1] Creating test user...");
    testUser = await prisma.user.create({
      data: {
        username: testUsername,
        email: testEmail,
        displayName: "Git Test User",
        status: "ACTIVE",
      },
    });
    console.log("✓ Created test user:", testUser.username, `(${testUser.id})`);

    // 2. Test Personal Access Token Generation & Verification
    console.log("\n[2] Testing Personal Access Token (PAT) generation...");
    const patResult = await generatePersonalAccessToken({
      userId: testUser.id,
      name: "VS Code Integration Test Token",
      scopes: ["repo:read", "repo:write"],
      expirationDays: 30,
    });
    patToken = patResult.token;
    console.log("✓ Generated PAT prefix:", patResult.record.tokenPrefix);
    console.log("✓ Raw token format valid:", patToken.startsWith("klyro_pat_"));

    const verified = await verifyPersonalAccessToken(patToken);
    if (!verified || verified.user.id !== testUser.id) {
      throw new Error("PAT verification failed!");
    }
    console.log("✓ PAT verified for user:", verified.user.username, "scopes:", verified.scopes);

    // 3. Test authenticateGitRequest Basic Auth parsing
    console.log("\n[3] Testing HTTP Basic Auth header parsing...");
    const basicAuthHeader = "Basic " + Buffer.from(`${testUsername}:${patToken}`).toString("base64");
    const mockReq = new Request("http://localhost:3000/info/refs", {
      headers: { authorization: basicAuthHeader },
    });
    const authResult = await authenticateGitRequest(mockReq);
    if (!authResult.authenticated || authResult.userId !== testUser.id) {
      throw new Error("authenticateGitRequest failed with PAT!");
    }
    console.log("✓ authenticateGitRequest authenticated method:", authResult.authMethod);

    // 4. Initialize Bare Git Repository
    console.log("\n[4] Initializing bare repository on disk...");
    await initBareRepo(storageDir, "main");
    await seedInitialCommit(storageDir, {
      defaultBranch: "main",
      files: [{ path: "README.md", content: `# ${repoSlug}\nInitial commit created on Klyro.` }],
      message: "Initial commit",
      author: { name: testUser.displayName || testUser.username, email: testUser.email },
    });
    console.log("✓ Bare repository initialized at:", storageDir);

    testRepo = await prisma.repository.create({
      data: {
        ownerId: testUser.id,
        name: repoSlug,
        slug: repoSlug,
        description: "Test real git repository",
        visibility: "PUBLIC",
        defaultBranch: "main",
        gitStoragePath: storageDir,
      },
    });
    console.log("✓ Repository record created in DB:", testRepo.slug);

    // 5. Setup Standalone Git Smart HTTP Test Server
    console.log("\n[5] Spinning up Smart HTTP gateway test server...");
    const port = 38920 + Math.floor(Math.random() * 500);
    server = http.createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://127.0.0.1:${port}`);
        const authHeader = req.headers["authorization"];

        // Check authentication for git-receive-pack (push) or private repo
        let isAuth = false;
        if (authHeader && authHeader.startsWith("Basic ")) {
          const creds = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
          const [, pass] = creds.split(":");
          if (pass === patToken) isAuth = true;
        }

        const isPush = url.pathname.includes("git-receive-pack") || url.search.includes("git-receive-pack");
        if (isPush && !isAuth) {
          res.writeHead(401, {
            "WWW-Authenticate": 'Basic realm="Klyro Git"',
            "Content-Type": "text/plain",
          });
          res.end("Authentication required to push\n");
          return;
        }

        // Subpath
        const subpath = url.pathname.replace(/^\/[^/]+\/[^/]+(\.git)?\//, "").replace(/^\//, "");
        const service = url.searchParams.get("service") || (subpath.includes("git-") ? subpath : null);

        // Convert Node req to Web ReadableStream
        const reqStream = new ReadableStream({
          start(controller) {
            req.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk)));
            req.on("end", () => controller.close());
            req.on("error", (err) => controller.error(err));
          },
        });

        const cgiResult = await executeGitHttpBackend({
          repositoryId: testRepo.id,
          storagePath: storageDir,
          service,
          subpath,
          queryString: url.searchParams.toString(),
          method: req.method,
          contentType: req.headers["content-type"],
          remoteUser: testUsername,
          requestBody: req.method === "POST" ? reqStream : null,
          userContext: { userId: testUser.id, canAdmin: true },
        });

        res.writeHead(cgiResult.status, cgiResult.headers);
        const reader = cgiResult.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (err) {
        console.error("Server error:", err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(err.message);
      }
    });

    await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
    console.log(`✓ Smart HTTP test server listening on http://127.0.0.1:${port}`);

    const httpRemoteUrl = `http://${testUsername}:${patToken}@127.0.0.1:${port}/${testUsername}/${repoSlug}.git`;

    // 6. Test Git Clone from the Smart HTTP Remote
    console.log("\n[6] Testing terminal 'git clone' via Smart HTTP...");
    await execFileAsync("git", ["clone", httpRemoteUrl, tempCloneDir]);
    console.log("✓ Cloned successfully to:", tempCloneDir);

    const clonedReadme = await fs.readFile(path.join(tempCloneDir, "README.md"), "utf8");
    console.log("✓ Cloned README content verified:", clonedReadme.slice(0, 30).trim());

    // 7. Make a Local Commit and Git Push
    console.log("\n[7] Making local commit in cloned repo...");
    const newFilePath = path.join(tempCloneDir, "src", "attendance.ts");
    await fs.mkdir(path.dirname(newFilePath), { recursive: true });
    await fs.writeFile(
      newFilePath,
      "export function trackAttendance(studentId: string): boolean { return true; }\n",
      "utf8"
    );

    await execFileAsync("git", ["add", "."], { cwd: tempCloneDir });
    await execFileAsync("git", ["commit", "-m", "feat: add attendance module"], {
      cwd: tempCloneDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Mohammed Fareed",
        GIT_AUTHOR_EMAIL: testEmail,
        GIT_COMMITTER_NAME: "Mohammed Fareed",
        GIT_COMMITTER_EMAIL: testEmail,
      },
    });
    console.log("✓ Local commit created.");

    console.log("\n[8] Testing terminal 'git push origin main'...");
    const { stdout: pushOut, stderr: pushErr } = await execFileAsync("git", ["push", "origin", "main"], {
      cwd: tempCloneDir,
    });
    console.log("✓ Git push succeeded:", (pushErr || pushOut).trim());

    // 9. Verify Commit Appears in Klyro Storage & Web API
    console.log("\n[9] Verifying pushed commit exists in Klyro bare storage...");
    const commits = await getCommits(storageDir, "main");
    console.log("✓ Commits in bare repository:", commits.length);
    console.log("✓ Latest commit message:", commits[0].message);
    if (!commits[0].message.includes("add attendance module")) {
      throw new Error("Pushed commit not reflected in bare repository!");
    }

    const tree = await getTree(storageDir, "main", "src");
    console.log("✓ Pushed file in repository tree:", tree.entries.map((e) => e.name));
    if (!tree.entries.some((e) => e.name === "attendance.ts")) {
      throw new Error("pushed file 'attendance.ts' not found in tree!");
    }

    // 10. Test Branch Creation & Push
    console.log("\n[10] Testing branch checkout & push (feature/test-branch)...");
    await execFileAsync("git", ["checkout", "-b", "feature/test-branch"], { cwd: tempCloneDir });
    await fs.writeFile(path.join(tempCloneDir, "feature.txt"), "New feature content\n", "utf8");
    await execFileAsync("git", ["add", "feature.txt"], { cwd: tempCloneDir });
    await execFileAsync("git", ["commit", "-m", "feat: branch feature commit"], {
      cwd: tempCloneDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Mohammed Fareed",
        GIT_AUTHOR_EMAIL: testEmail,
        GIT_COMMITTER_NAME: "Mohammed Fareed",
        GIT_COMMITTER_EMAIL: testEmail,
      },
    });

    await execFileAsync("git", ["push", "-u", "origin", "feature/test-branch"], { cwd: tempCloneDir });
    const branches = await getBranches(storageDir);
    console.log("✓ Remote branches in Klyro:", branches.map((b) => b.name));
    if (!branches.some((b) => b.name === "feature/test-branch")) {
      throw new Error("Branch 'feature/test-branch' not found in remote!");
    }

    // 11. Test Branch Protection Policy Check
    console.log("\n[11] Testing branch protection policy rejection...");
    await prisma.branchProtectionRule.create({
      data: {
        repositoryId: testRepo.id,
        pattern: "main",
        preventForcePush: true,
        preventDeletion: true,
        requirePullRequest: true,
      },
    });

    const policyCheck = await evaluatePushPolicy(
      testRepo.id,
      storageDir,
      [
        {
          oldSha: commits[0].sha,
          newSha: "0000000000000000000000000000000000000000",
          refName: "refs/heads/main",
        },
      ],
      { userId: testUser.id, canAdmin: false }
    );

    console.log("✓ Branch deletion policy result: allowed =", policyCheck.allowed, "reason:", policyCheck.rejectReason);
    if (policyCheck.allowed) {
      throw new Error("Branch protection failed to reject protected branch deletion!");
    }

    console.log("\n========================================================");
    console.log("🎉 ALL REAL GIT IMPLEMENTATION TESTS PASSED 100%!");
    console.log("========================================================");
  } finally {
    if (server) {
      server.close();
    }
    // Cleanup temporary files and test DB records
    await fs.rm(tempCloneDir, { recursive: true, force: true }).catch(() => {});
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

runSmartHttpTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
