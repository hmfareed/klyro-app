import { Server, type Connection, type AuthContext, type Session } from "ssh2";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { prisma } from "@/shared/db/prisma";
import { computeSshFingerprint, recordSshKeyUsage } from "@/server/auth/ssh-key-service";
import { getRepoStoragePath, ensureBareRepository } from "@/server/git/git-service";
import { handlePostPushEvent } from "@/server/git/hooks/post-push";

const DATA_SSH_DIR = path.join(process.cwd(), "data", "ssh");
const HOST_KEY_PATH = path.join(DATA_SSH_DIR, "klyro_ssh_host_key.pem");

/**
 * Loads an existing host key or generates a new RSA 2048-bit key and persists it
 */
export function getOrCreateHostKey(): string {
  if (process.env.SSH_HOST_KEY) {
    return process.env.SSH_HOST_KEY;
  }

  if (fs.existsSync(HOST_KEY_PATH)) {
    return fs.readFileSync(HOST_KEY_PATH, "utf8");
  }

  if (!fs.existsSync(DATA_SSH_DIR)) {
    fs.mkdirSync(DATA_SSH_DIR, { recursive: true });
  }

  const { privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "pkcs1", format: "pem" },
    privateKeyEncoding: { type: "pkcs1", format: "pem" },
  });

  fs.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
  return privateKey;
}

/**
 * Valid Git SSH command parser
 * Matches git-upload-pack, git-receive-pack, git-upload-archive
 * Format: git-upload-pack '/owner/repo.git' or git-receive-pack 'owner/repo'
 */
const GIT_COMMAND_REGEX =
  /^(?:git-)?(upload-pack|receive-pack|upload-archive)\s+['"]?\/?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git)?['"]?$/;

async function withPrismaRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === retries - 1 || (err.code !== "P1001" && !err.message?.includes("Can't reach database"))) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw new Error("Database retry exhausted");
}

export interface SshServerOptions {
  port?: number;
  host?: string;
  hostKey?: string;
}

/**
 * Creates and configures the Klyro SSH Server
 */
export function createSshServer(options: SshServerOptions = {}) {
  const hostKey = options.hostKey || getOrCreateHostKey();

  const server = new Server(
    {
      hostKeys: [hostKey],
    },
    (client: Connection) => {
      let authenticatedUser: { id: string; username: string; displayName?: string | null; email?: string | null } | null = null;
      let authenticatedKeyId: string | null = null;

      // Handle Authentication
      client.on("authentication", async (ctx: AuthContext) => {
        try {
          if (ctx.method !== "publickey") {
            return ctx.reject(["publickey"]);
          }

          const fingerprint = computeSshFingerprint(ctx.key.data);
          const keyRecord = await withPrismaRetry(() =>
            prisma.userSshKey.findUnique({
              where: { fingerprint },
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    displayName: true,
                    email: true,
                  },
                },
              },
            })
          );

          if (!keyRecord || !keyRecord.user) {
            return ctx.reject();
          }

          // In SSH publickey auth: client first sends key without signature to probe acceptance
          if (!ctx.signature) {
            return ctx.accept();
          }

          // Client provided signature: verify cryptographic challenge
          const verifyFn = (ctx.key as any).verify;
          const isSignatureValid = typeof verifyFn === "function"
            ? verifyFn.call(ctx.key, ctx.blob, ctx.signature, ctx.key.algo)
            : true;

          if (isSignatureValid) {
            authenticatedUser = keyRecord.user;
            authenticatedKeyId = keyRecord.id;
            recordSshKeyUsage(keyRecord.id).catch(() => {});
            return ctx.accept();
          } else {
            return ctx.reject();
          }
        } catch (err) {
          console.error("[SSH Server] Auth error:", err);
          return ctx.reject();
        }
      });

      // Handle Ready Session
      client.on("ready", () => {
        client.on("session", (acceptSession) => {
          const session = acceptSession();

          // Reject interactive PTY requests with a polite message (like GitHub)
          session.on("pty", (acceptPty) => {
            acceptPty();
          });

          // Handle interactive shell (e.g. `ssh git@klyro.dev`)
          session.on("shell", (acceptStream) => {
            const stream = acceptStream();
            const username = authenticatedUser?.username || "developer";
            stream.write(
              `\r\n` +
              `  Hi @${username}! You've successfully authenticated to Klyro.\r\n` +
              `  Klyro does not provide interactive shell access.\r\n\r\n`
            );
            stream.exit(0);
            stream.end();
          });

          // Handle exec (Git commands or test queries)
          session.on("exec", async (acceptStream, _rejectStream, info) => {
            const stream = acceptStream();
            const rawCommand = (info.command || "").trim();
            console.log(`[SSH Server] Received exec command: "${rawCommand}"`);

            function closeWithError(msg: string, code = 1) {
              stream.stderr.write(msg);
              stream.exit(code);
              stream.close();
            }

            const user = authenticatedUser;
            if (!user) {
              closeWithError("FATAL: Unauthorized. Please add your SSH public key to your Klyro profile.\r\n");
              return;
            }

            // Check if git command
            const match = rawCommand.match(GIT_COMMAND_REGEX);
            if (!match) {
              closeWithError(
                `FATAL: Interactive or arbitrary shell commands ('${rawCommand}') are forbidden.\r\n` +
                `Klyro SSH exclusively supports Git operations.\r\n`
              );
              return;
            }

            const [, action, owner, repoName] = match;
            const gitAction = `git-${action}`; // e.g. git-upload-pack, git-receive-pack

            try {
              // Resolve repository
              const repo = await withPrismaRetry(() =>
                prisma.repository.findFirst({
                  where: {
                    OR: [
                      { slug: `${owner}/${repoName}` },
                      {
                        name: repoName,
                        owner: {
                          OR: [{ username: owner }, { id: owner }],
                        },
                      },
                    ],
                  },
                  include: {
                    owner: {
                      select: { id: true, username: true },
                    },
                    collaborators: {
                      where: { userId: user.id },
                    },
                  },
                })
              );

              if (!repo || repo.deletedAt) {
                closeWithError(`FATAL: Repository '${owner}/${repoName}' not found.\r\n`);
                return;
              }

              const isOwner = repo.ownerId === user.id;
              const hasCollab = repo.collaborators.length > 0;
              const collabRole = hasCollab ? repo.collaborators[0].role : null;
              const hasWrite =
                isOwner ||
                collabRole === "OWNER" ||
                collabRole === "MAINTAINER" ||
                collabRole === "CONTRIBUTOR";

              const hasRead =
                repo.visibility === "PUBLIC" ||
                isOwner ||
                hasCollab;

              // Check read permission for upload-pack
              if (action === "upload-pack" || action === "upload-archive") {
                if (!hasRead) {
                  closeWithError(`FATAL: You do not have permission to read repository '${owner}/${repoName}'.\r\n`);
                  return;
                }
              }

              // Check write permission for receive-pack (push)
              if (action === "receive-pack") {
                if (repo.archived) {
                  closeWithError("FATAL: Repository is archived and read-only.\r\n");
                  return;
                }

                if (!hasWrite) {
                  closeWithError(`FATAL: You do not have permission to push to repository '${owner}/${repoName}'.\r\n`);
                  return;
                }
              }

              // Ensure bare repository storage exists
              const storagePath = getRepoStoragePath(repo.id);
              await ensureBareRepository(repo.id, repo.name, repo.defaultBranch);

              // Spawn native git process
              const gitEnv: NodeJS.ProcessEnv = {
                ...process.env,
                GIT_DIR: storagePath,
                GL_ID: user.id,
                GL_USER: user.username,
              };

              const gitProc = spawn("git", [action, storagePath], {
                env: gitEnv,
              });

              stream.pipe(gitProc.stdin);
              gitProc.stdout.pipe(stream, { end: false });
              gitProc.stderr.pipe(stream.stderr, { end: false });

              gitProc.on("error", (procErr) => {
                console.error("[SSH Server] gitProc error:", procErr);
                closeWithError(`FATAL: Failed to execute Git process: ${procErr.message}\r\n`);
              });

              gitProc.on("close", async (exitCode) => {
                const code = exitCode ?? 0;
                console.log(`[SSH Server] gitProc closed with code: ${code}`);
                if (action === "receive-pack" && code === 0 && user) {
                  handlePostPushEvent({
                    repositoryId: repo.id,
                    storagePath,
                    actorId: user.id,
                  }).catch((err) => {
                    console.error("[SSH Server] Post-push hook error:", err);
                  });
                }
                stream.exit(code);
                stream.end();
              });
            } catch (err: any) {
              console.error("[SSH Server] Exec error:", err);
              stream.stderr.write(`FATAL: Internal server error: ${err.message}\r\n`);
              stream.exit(1);
              stream.end();
            }
          });
        });
      });

      client.on("error", (err) => {
        // Suppress expected client socket drop logs
        if ((err as any).code !== "ECONNRESET") {
          console.error("[SSH Server] Client connection error:", err.message);
        }
      });
    }
  );

  return server;
}

/**
 * Starts the SSH Server listening on the specified port
 */
export function startSshServer(options: SshServerOptions = {}) {
  const port = options.port || Number(process.env.SSH_PORT) || 2222;
  const host = options.host || "0.0.0.0";
  const server = createSshServer(options);

  return new Promise<{ server: Server; port: number }>((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      console.log(`[Klyro SSH Gateway] Listening on ${host}:${port}`);
      resolve({ server, port });
    });
  });
}

// Allow direct execution: `tsx src/server/git/ssh/ssh-server.ts`
if (require.main === module || (typeof process.env.RUN_SSH_DAEMON === "string" && process.env.RUN_SSH_DAEMON === "true")) {
  startSshServer().catch((err) => {
    console.error("[Klyro SSH Gateway] Fatal startup error:", err);
    process.exit(1);
  });
}
