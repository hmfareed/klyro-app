import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { compareBranches } from "@/server/git/git-service";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/pulls?status=OPEN
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  // If compare mode is requested: /pulls?compare=true&base=main&head=feature
  const isCompare = url.searchParams.get("compare") === "true";
  const baseBranch = url.searchParams.get("base");
  const headBranch = url.searchParams.get("head");

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  if (isCompare && baseBranch && headBranch) {
    try {
      const comparison = await compareBranches(repository.gitStoragePath, baseBranch, headBranch);
      return apiOk({ comparison });
    } catch (err: any) {
      return apiError("GIT_ERROR", `Failed to compare branches: ${err.message}`, null, 400);
    }
  }

  const status = url.searchParams.get("status") || undefined;

  try {
    const pullRequests = await prisma.pullRequest.findMany({
      where: {
        repositoryId: repository.id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: {
          select: { comments: true, reviews: true },
        },
      },
    });

    const counts = {
      open: await prisma.pullRequest.count({ where: { repositoryId: repository.id, status: "OPEN" } }),
      merged: await prisma.pullRequest.count({ where: { repositoryId: repository.id, status: "MERGED" } }),
      closed: await prisma.pullRequest.count({ where: { repositoryId: repository.id, status: "CLOSED" } }),
    };

    return apiOk({ pullRequests, counts });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to load pull requests", null, 500);
  }
}

const createPRSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().max(10000).optional(),
  baseBranch: z.string().min(1),
  headBranch: z.string().min(1),
});

// POST /api/v1/repositories/[owner]/[repo]/pulls — open a new pull request
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  let userId = await getSessionUserId();
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createPRSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { title, body: prBody, baseBranch, headBranch } = parsed.data;

  if (baseBranch === headBranch) {
    return apiError("INVALID_BRANCHES", "Base and head branch cannot be the same", null, 400);
  }

  try {
    // 1. Verify branches can be compared in Git
    const comparison = await compareBranches(repository.gitStoragePath, baseBranch, headBranch);

    // 2. Next PR number
    const lastPR = await prisma.pullRequest.findFirst({
      where: { repositoryId: repository.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (lastPR?.number || 0) + 1;

    // 3. Create PR record
    const pullRequest = await prisma.pullRequest.create({
      data: {
        repositoryId: repository.id,
        number,
        title,
        body: prBody || "",
        baseBranch,
        headBranch,
        authorId: userId,
        status: "OPEN",
      },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // 4. Emit Buildstream event if linked to project
    if (repository.projectId) {
      await recordActivityEvent({
        actorId: userId,
        projectId: repository.projectId,
        type: ActivityEventType.PULL_REQUEST_OPENED,
        targetType: "PullRequest",
        targetId: pullRequest.id,
        metadata: {
          number,
          title,
          baseBranch,
          headBranch,
          repoName: repository.name,
          repoSlug: repository.slug,
          commitsCount: comparison.commits.length,
          filesCount: comparison.files.length,
        },
      });
    }

    // 5. Dispatch webhooks
    dispatchRepositoryWebhooks({
      repositoryId: repository.id,
      event: "pull_request",
      payload: {
        action: "opened",
        pull_request: pullRequest,
      },
    });

    return apiOk({ pullRequest }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to open pull request: ${err.message}`, null, 500);
  }
}
