import { NextRequest } from "next/server";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { authenticateGitRequest } from "@/server/auth/pat-service";
import { executeGitHttpBackend } from "@/server/git/git-http-gateway";

interface GitRouteProps {
  params: Promise<{
    owner: string;
    repo: string;
    gitPath: string[];
  }>;
}

/**
 * Git Smart HTTP Route Handler
 * Serves git-upload-pack (fetch/clone) and git-receive-pack (push)
 */
async function handleGitRequest(req: NextRequest, { params }: GitRouteProps) {
  const { owner, repo, gitPath } = await params;

  // Clean repository slug (strip trailing .git if present)
  const repoSlug = repo.endsWith(".git") ? repo.slice(0, -4) : repo;
  const subpath = gitPath.join("/");

  // Determine Git service
  const url = new URL(req.url);
  const service =
    url.searchParams.get("service") ||
    (subpath.includes("git-upload-pack") ? "git-upload-pack" : null) ||
    (subpath.includes("git-receive-pack") ? "git-receive-pack" : null);

  // Authenticate user via Personal Access Token (or password/session)
  const auth = await authenticateGitRequest(req);

  // Resolve repository with permission evaluation
  const access = await getRepositoryWithAccess(owner, repoSlug, auth.userId);

  // If repo is not found:
  // If request is unauthenticated, send 401 so git client prompts credentials (might be a private repo)
  if (!access) {
    if (!auth.authenticated) {
      return new Response("Authentication required\n", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Klyro Git"',
          "Content-Type": "text/plain",
        },
      });
    }
    return new Response("Repository not found\n", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const { repository, viewer } = access;
  const isWrite = service === "git-receive-pack" || subpath.includes("git-receive-pack");

  // Read permission check (git clone / fetch / upload-pack)
  if (!isWrite) {
    if (!viewer.canRead) {
      if (!auth.authenticated) {
        return new Response("Authentication required to access private repository\n", {
          status: 401,
          headers: {
            "WWW-Authenticate": 'Basic realm="Klyro Git"',
            "Content-Type": "text/plain",
          },
        });
      }
      return new Response("Forbidden: You do not have read permission for this repository\n", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (auth.authenticated && auth.authMethod === "pat") {
      const hasReadScope =
        auth.scopes.includes("repo:read") ||
        auth.scopes.includes("repo:write") ||
        auth.scopes.includes("repo:admin");
      if (!hasReadScope) {
        return new Response("Forbidden: Personal access token lacks 'repo:read' scope\n", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }
  }

  // Write permission check (git push / receive-pack)
  if (isWrite) {
    if (!auth.authenticated) {
      return new Response("Authentication required to push to this repository\n", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Klyro Git"',
          "Content-Type": "text/plain",
        },
      });
    }

    if (repository.archived) {
      return new Response("Push rejected: This repository is archived and read-only\n", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (repository.status !== "ACTIVE") {
      return new Response("Push rejected: Repository is pending deletion\n", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (!viewer.canWrite) {
      return new Response("Forbidden: You do not have write permissions for this repository\n", {
        status: 403,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (auth.authMethod === "pat") {
      const hasWriteScope =
        auth.scopes.includes("repo:write") || auth.scopes.includes("repo:admin");
      if (!hasWriteScope) {
        return new Response("Forbidden: Personal access token lacks 'repo:write' scope\n", {
          status: 403,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }
  }

  // Execute Git Smart HTTP CGI handler
  try {
    const gitCgiResult = await executeGitHttpBackend({
      repositoryId: repository.id,
      storagePath: repository.gitStoragePath,
      service,
      subpath,
      queryString: url.searchParams.toString(),
      method: req.method,
      contentType: req.headers.get("content-type") || undefined,
      remoteUser: auth.user?.username || "anonymous",
      requestBody: req.body,
      userContext: auth.userId
        ? { userId: auth.userId, canAdmin: viewer.canAdmin }
        : undefined,
    });

    return new Response(gitCgiResult.body, {
      status: gitCgiResult.status,
      headers: gitCgiResult.headers,
    });
  } catch (err: any) {
    console.error("[GitGateway] Error processing Git request:", err);
    return new Response(`Git server error: ${err.message}\n`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}

export const GET = handleGitRequest;
export const POST = handleGitRequest;
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min for large packfiles
