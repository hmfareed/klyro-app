import ssh2Pkg from "ssh2";
const { Client, utils } = ssh2Pkg;
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "../src/shared/db/prisma";
import {
  addSshKeyForUser,
  findUserBySshFingerprint,
  deleteSshKeyForUser,
} from "../src/server/auth/ssh-key-service";
import {
  ensureBareRepository,
  seedInitialCommit,
  createCommitOnBranch,
  getCommits,
  getRepoStoragePath,
  getTree,
} from "../src/server/git/git-service";
import { createSshServer } from "../src/server/git/ssh/ssh-server";

const execFileAsync = promisify(execFile);

async function runSshGitTestSuite() {
  console.log("=== STARTING KLYRO SSH GIT ACCESS TEST SUITE ===");

  const timestamp = Date.now();
  const testUsername = `sshuser_${timestamp}`;
  const testEmail = `sshuser_${timestamp}@klyro.dev`;
  let sshServer = null;
  const tempFilesToCleanup = [];

  try {
    // 1. Create Test User
    console.log("\n[1] Creating test user in PostgreSQL...");
    const testUser = await prisma.user.create({
      data: {
        username: testUsername,
        displayName: `SSH Test User ${timestamp}`,
        email: testEmail,
        passwordHash: "mock_hash_for_test",
      },
    });
    console.log("✓ Created test user:", testUser.username, `(${testUser.id})`);

    // 2. Generate SSH Key Pair (Ed25519)
    console.log("\n[2] Generating Ed25519 SSH Key Pair...");
    const keyPair = utils.generateKeyPairSync("ed25519");
    const openSshPublicKey = `${keyPair.public.trim()} ${testUser.username}@laptop`;
    console.log("✓ Generated public key:", openSshPublicKey.slice(0, 45) + "...");

    // 3. Register SSH Public Key in Klyro Database
    console.log("\n[3] Registering SSH key via ssh-key-service...");
    const keyRecord = await addSshKeyForUser({
      userId: testUser.id,
      title: "Work Laptop (Ed25519)",
      publicKey: openSshPublicKey,
    });

    console.log("✓ Key saved with fingerprint:", keyRecord.fingerprint);
    console.log("✓ Key type:", keyRecord.keyType);

    // Verify lookup by fingerprint
    const lookedUp = await findUserBySshFingerprint(keyRecord.fingerprint);
    if (!lookedUp || lookedUp.user.id !== testUser.id) {
      throw new Error("Failed to lookup user by SSH key fingerprint!");
    }
    console.log("✓ User successfully identified by fingerprint:", lookedUp.user.username);

    // 4. Initialize Bare Git Repository
    console.log("\n[4] Initializing bare repository on disk...");
    const testRepoName = `sshrepo-${timestamp}`;
    const repoId = `cmue_test_${timestamp}`;
    const storageDir = getRepoStoragePath(repoId);
    await ensureBareRepository(storageDir, testRepoName, "main");

    const testRepo = await prisma.repository.create({
      data: {
        id: repoId,
        name: testRepoName,
        slug: testRepoName,
        ownerId: testUser.id,
        defaultBranch: "main",
        visibility: "PUBLIC",
        gitStoragePath: storageDir,
      },
    });

    // Add initial commit
    await seedInitialCommit(storageDir, {
      defaultBranch: "main",
      files: [{ path: "README.md", content: `# ${testRepoName}\nInitial SSH test repo.\n` }],
      message: "Initial commit",
      author: { name: testUser.displayName, email: testUser.email },
    });
    console.log("✓ Bare repo initialized at:", storageDir);

    // 5. Start SSH Server on Ephemeral Port
    console.log("\n[5] Starting Klyro SSH Server daemon...");
    const testPort = 22200 + Math.floor(Math.random() * 500);
    sshServer = createSshServer();

    await new Promise((resolve, reject) => {
      sshServer.on("error", reject);
      sshServer.listen(testPort, "127.0.0.1", () => {
        console.log(`✓ Klyro SSH Gateway listening on 127.0.0.1:${testPort}`);
        resolve();
      });
    });

    // 6. Test Interactive Shell / Greeting (ssh -T)
    console.log("\n[6] Testing SSH authentication & interactive shell greeting...");
    const greetingOutput = await new Promise((resolve, reject) => {
      const conn = new Client();
      let output = "";

      conn
        .on("ready", () => {
          conn.shell((err, stream) => {
            if (err) return reject(err);
            stream
              .on("data", (chunk) => {
                output += chunk.toString();
              })
              .on("close", () => {
                conn.end();
                resolve(output);
              });
          });
        })
        .on("error", reject)
        .connect({
          host: "127.0.0.1",
          port: testPort,
          username: "git",
          privateKey: keyPair.private,
        });
    });

    console.log("✓ Received greeting:\n", greetingOutput.trim());
    if (!greetingOutput.includes(`Hi @${testUser.username}!`)) {
      throw new Error(`Greeting did not include expected username @${testUser.username}!`);
    }
    if (!greetingOutput.includes("Klyro does not provide interactive shell access")) {
      throw new Error("Greeting did not inform user about restricted shell!");
    }
    console.log("✓ Interactive shell guard verified.");

    // 7. Test Arbitrary Command Rejection (Security check)
    console.log("\n[7] Testing command injection rejection (e.g. bash / cat / etc.)...");
    const forbiddenCommandResult = await new Promise((resolve, reject) => {
      const conn = new Client();
      let stderr = "";
      let exitCode = null;

      conn
        .on("ready", () => {
          conn.exec('cat /etc/passwd', (err, stream) => {
            if (err) return reject(err);
            stream.stderr.on("data", (chunk) => {
              stderr += chunk.toString();
            });
            stream.on("exit", (code) => {
              exitCode = code;
              setTimeout(() => {
                conn.end();
                resolve({ exitCode, stderr });
              }, 50);
            });
          });
        })
        .on("error", reject)
        .connect({
          host: "127.0.0.1",
          port: testPort,
          username: "git",
          privateKey: keyPair.private,
        });
    });

    console.log("✓ Forbidden command exit code:", forbiddenCommandResult.exitCode);
    console.log("✓ Stderr message:", forbiddenCommandResult.stderr.trim());
    if (forbiddenCommandResult.exitCode !== 1) {
      throw new Error("Forbidden command did not exit with code 1!");
    }
    if (!forbiddenCommandResult.stderr.includes("forbidden")) {
      throw new Error("Stderr did not mention forbidden command!");
    }

    // 8. Test Native Git Clone & Push over SSH
    console.log("\n[8] Testing native 'git clone' & 'git push' over SSH...");
    const tempKeyFile = path.join(os.tmpdir(), `klyro_ssh_test_key_${timestamp}`);
    const tempCloneDir = path.join(os.tmpdir(), `klyro_ssh_clone_${timestamp}`);
    tempFilesToCleanup.push(tempKeyFile, tempCloneDir);

    await fs.writeFile(tempKeyFile, keyPair.private, { encoding: "utf8", mode: 0o600 });

    // On Windows, fix file ACL if icacls is available to satisfy ssh permissions
    if (process.platform === "win32") {
      try {
        await execFileAsync("icacls", [tempKeyFile, "/inheritance:r"]).catch(() => {});
        await execFileAsync("icacls", [tempKeyFile, "/grant:r", `${process.env.USERNAME}:(R)`]).catch(() => {});
      } catch {}
    }

    const sshCommand = `ssh -i "${tempKeyFile}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL -p ${testPort}`;
    const sshRepoUrl = `ssh://git@127.0.0.1:${testPort}/${testUser.username}/${testRepoName}.git`;

    console.log("Running git clone from:", sshRepoUrl);
    const { stdout: cloneOut, stderr: cloneErr } = await execFileAsync("git", [
      "-c",
      `core.sshCommand=${sshCommand}`,
      "clone",
      sshRepoUrl,
      tempCloneDir,
    ]);
    console.log("✓ Git clone completed over SSH.");

    const clonedReadme = await fs.readFile(path.join(tempCloneDir, "README.md"), "utf8");
    if (!clonedReadme.includes(testRepoName)) {
      throw new Error("Cloned README file does not contain expected repo name!");
    }
    console.log("✓ Cloned repository files verified.");

    // 9. Create commit in cloned repo and push over SSH
    console.log("\n[9] Creating local commit and pushing over SSH...");
    const newFilePath = path.join(tempCloneDir, "ssh-test.txt");
    await fs.writeFile(newFilePath, `Committed via SSH at ${new Date().toISOString()}\n`);

    await execFileAsync("git", ["add", "ssh-test.txt"], { cwd: tempCloneDir });
    await execFileAsync(
      "git",
      [
        "-c",
        `user.name=${testUser.displayName}`,
        "-c",
        `user.email=${testUser.email}`,
        "commit",
        "-m",
        "feat: add ssh-test.txt via SSH git push",
      ],
      { cwd: tempCloneDir }
    );

    const { stdout: pushOut, stderr: pushErr } = await execFileAsync(
      "git",
      ["-c", `core.sshCommand=${sshCommand}`, "push", "origin", "main"],
      { cwd: tempCloneDir }
    );

    console.log("✓ Push output:\n", (pushOut + "\n" + pushErr).trim());

    // 10. Verify commit arrived in bare repository storage
    console.log("\n[10] Verifying pushed commit exists in Klyro bare repository...");
    const commits = await getCommits(storageDir, "main");
    console.log("✓ Commits in bare storage:", commits.length);
    console.log("✓ Latest commit message:", commits[0].message);

    if (commits.length < 2 || !commits[0].message.includes("via SSH git push")) {
      throw new Error("Pushed commit not found in bare repository storage!");
    }

    const tree = await getTree(storageDir, "main");
    if (!tree.entries.some((e) => e.name === "ssh-test.txt")) {
      throw new Error("Pushed file 'ssh-test.txt' not found in tree!");
    }
    console.log("✓ Pushed file verified in repository tree.");

    console.log("\n========================================================");
    console.log("🎉 ALL SSH GIT ACCESS TESTS PASSED 100%!");
    console.log("========================================================\n");
  } finally {
    if (sshServer) {
      try {
        sshServer.close();
      } catch {}
    }
    for (const f of tempFilesToCleanup) {
      try {
        await fs.rm(f, { recursive: true, force: true });
      } catch {}
    }
  }
}

runSshGitTestSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
