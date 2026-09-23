import { spawn } from "node:child_process";
import { Readable, PassThrough } from "node:stream";
import path from "node:path";
import fs from "node:fs/promises";
import { getBranches, runGit } from "@/server/git/git-service";
import { handlePostPushEvent } from "@/server/git/hooks/post-push";
import { parseRefUpdateLines, evaluatePushPolicy } from "@/server/git/hooks/policy";

export interface ExecuteGitCgiOptions {
  repositoryId: string;
  storagePath: string;
  service: string | null;
  subpath: string;
  queryString: string;
  method: string;
  contentType?: string;
  remoteUser?: string;
  requestBody?: ReadableStream<Uint8Array> | null;
  userContext?: { userId: string; canAdmin: boolean };
}

export interface GitCgiResponse {
  status: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array>;
  exitPromise: Promise<number>;
}

/**
 * Ensures bare repository has core git config required for Smart HTTP hosting
 */
export async function ensureRepoHttpConfig(storagePath: string): Promise<void> {
  try {
    await runGit(storagePath, ["config", "http.receivepack", "true"]);
    await runGit(storagePath, ["config", "http.uploadpack", "true"]);
    await runGit(storagePath, ["config", "core.logAllRefUpdates", "true"]);
  } catch (err) {
    console.warn("[GitGateway] Warning: Failed to set http config on repo:", err);
  }
}

/**
 * Executes native git http-backend CGI and streams request/response
 */
export async function executeGitHttpBackend(
  options: ExecuteGitCgiOptions
): Promise<GitCgiResponse> {
  const {
    repositoryId,
    storagePath,
    subpath,
    queryString,
    method,
    contentType,
    remoteUser,
    requestBody,
    userContext,
  } = options;

  // Ensure repository exists and has Smart HTTP enabled
  await ensureRepoHttpConfig(storagePath);

  const repoDirName = path.basename(storagePath);
  const repoParentDir = path.dirname(storagePath);

  // Snapshot refs before receive-pack for post-push event detection
  const isReceivePack =
    subpath.includes("git-receive-pack") || queryString.includes("git-receive-pack");
  let beforeBranches: Map<string, string> = new Map();
  if (isReceivePack && method === "POST") {
    try {
      const branches = await getBranches(storagePath);
      for (const b of branches) {
        beforeBranches.set(b.name, b.commitSha);
      }
    } catch {}
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_PROJECT_ROOT: repoParentDir,
    GIT_HTTP_EXPORT_ALL: "1",
    PATH_INFO: `/${repoDirName}/${subpath}`,
    QUERY_STRING: queryString || "",
    REQUEST_METHOD: method,
    CONTENT_TYPE: contentType || "",
    REMOTE_USER: remoteUser || "anonymous",
    REMOTE_ADDR: "127.0.0.1",
  };

  const gitProcess = spawn("git", ["http-backend"], {
    cwd: storagePath,
    env,
  });

  // Handle incoming request body streaming
  if (requestBody && method === "POST") {
    const nodeReadable = Readable.fromWeb(requestBody as any);
    nodeReadable.pipe(gitProcess.stdin);
  } else {
    gitProcess.stdin.end();
  }

  // Parse CGI output headers & stream response
  return new Promise<GitCgiResponse>((resolve, reject) => {
    let headerBuffer = Buffer.alloc(0);
    let headersParsed = false;
    let status = 200;
    const responseHeaders: Record<string, string> = {};

    const responseStream = new PassThrough();

    gitProcess.stdout.on("data", (chunk: Buffer) => {
      if (!headersParsed) {
        headerBuffer = Buffer.concat([headerBuffer, chunk]);
        const crlfIndex = headerBuffer.indexOf("\r\n\r\n");
        const lfIndex = headerBuffer.indexOf("\n\n");
        const delim = crlfIndex !== -1 ? "\r\n\r\n" : lfIndex !== -1 ? "\n\n" : null;
        const splitIndex = crlfIndex !== -1 ? crlfIndex : lfIndex;

        if (delim && splitIndex !== -1) {
          const headerText = headerBuffer.subarray(0, splitIndex).toString("utf8");
          const remainingBody = headerBuffer.subarray(splitIndex + delim.length);
          headersParsed = true;

          for (const line of headerText.split(/\r?\n/)) {
            const colon = line.indexOf(":");
            if (colon !== -1) {
              const k = line.slice(0, colon).trim().toLowerCase();
              const v = line.slice(colon + 1).trim();
              if (k === "status") {
                status = parseInt(v.split(" ")[0], 10) || 200;
              } else {
                responseHeaders[k] = v;
              }
            }
          }

          if (remainingBody.length > 0) {
            responseStream.write(remainingBody);
          }

          resolve({
            status,
            headers: responseHeaders,
            body: Readable.toWeb(responseStream) as ReadableStream<Uint8Array>,
            exitPromise,
          });
        }
      } else {
        responseStream.write(chunk);
      }
    });

    gitProcess.stderr.on("data", (data) => {
      const msg = data.toString();
      // Log git server diagnostics
      if (process.env.NODE_ENV !== "production") {
        console.log(`[GitBackend Stderr] ${msg.trim()}`);
      }
    });

    const exitPromise = new Promise<number>((resolveExit) => {
      gitProcess.on("close", async (code) => {
        responseStream.end();
        const exitCode = code ?? 0;

        // If post-push succeeded, process post-receive events
        if (isReceivePack && method === "POST" && exitCode === 0) {
          try {
            const afterBranches = await getBranches(storagePath);
            const afterMap = new Map<string, string>();
            for (const b of afterBranches) {
              afterMap.set(b.name, b.commitSha);
            }

            const refUpdates: Array<{ oldSha: string; newSha: string; refName: string }> = [];

            // Detect creations and updates
            for (const [branch, newSha] of afterMap.entries()) {
              const oldSha = beforeBranches.get(branch);
              if (!oldSha) {
                refUpdates.push({
                  oldSha: "0000000000000000000000000000000000000000",
                  newSha,
                  refName: `refs/heads/${branch}`,
                });
              } else if (oldSha !== newSha) {
                refUpdates.push({
                  oldSha,
                  newSha,
                  refName: `refs/heads/${branch}`,
                });
              }
            }

            // Detect deletions
            for (const [branch, oldSha] of beforeBranches.entries()) {
              if (!afterMap.has(branch)) {
                refUpdates.push({
                  oldSha,
                  newSha: "0000000000000000000000000000000000000000",
                  refName: `refs/heads/${branch}`,
                });
              }
            }

            if (refUpdates.length > 0 && userContext?.userId) {
              await handlePostPushEvent({
                repositoryId,
                storagePath,
                actorId: userContext.userId,
                refUpdates,
              });
            }
          } catch (err) {
            console.error("[GitGateway] Post push handler error:", err);
          }
        }

        resolveExit(exitCode);
      });
    });

    gitProcess.on("error", (err) => {
      responseStream.destroy(err);
      if (!headersParsed) {
        reject(err);
      }
    });
  });
}
