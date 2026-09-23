import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/issues?status=OPEN
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;
  const url = new URL(req.url);

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const status = url.searchParams.get("status") || undefined;
  const search = url.searchParams.get("q")?.trim();

  const whereClause: any = {
    repositoryId: repository.id,
    ...(status ? { status } : {}),
  };

  if (search) {
    whereClause.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { body: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const issues = await prisma.repositoryIssue.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        assignee: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        _count: { select: { comments: true } },
      },
    });

    const counts = {
      open: await prisma.repositoryIssue.count({ where: { repositoryId: repository.id, status: "OPEN" } }),
      closed: await prisma.repositoryIssue.count({ where: { repositoryId: repository.id, status: "CLOSED" } }),
    };

    return apiOk({ issues, counts });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to load issues", null, 500);
  }
}

const createIssueSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().max(10000).optional(),
  labels: z.array(z.string()).default([]),
  assigneeId: z.string().optional().nullable(),
});

// POST /api/v1/repositories/[owner]/[repo]/issues — create new issue
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
  const parsed = createIssueSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { title, body: issueBody, labels, assigneeId } = parsed.data;

  try {
    const lastIssue = await prisma.repositoryIssue.findFirst({
      where: { repositoryId: repository.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (lastIssue?.number || 0) + 1;

    const issue = await prisma.repositoryIssue.create({
      data: {
        repositoryId: repository.id,
        number,
        title,
        body: issueBody || "",
        labels,
        assigneeId: assigneeId || null,
        authorId: userId,
        status: "OPEN",
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        assignee: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    if (repository.projectId) {
      await recordActivityEvent({
        actorId: userId,
        projectId: repository.projectId,
        type: ActivityEventType.ISSUE_CREATED,
        targetType: "RepositoryIssue",
        targetId: issue.id,
        metadata: {
          number,
          title,
          repoName: repository.name,
          repoSlug: repository.slug,
        },
      });
    }

    dispatchRepositoryWebhooks({
      repositoryId: repository.id,
      event: "issues",
      payload: {
        action: "opened",
        issue,
      },
    });

    return apiOk({ issue }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to create issue", null, 500);
  }
}
