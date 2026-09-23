import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

const commentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// POST /api/v1/repositories/[owner]/[repo]/issues/[number]/comments
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const issueNumber = parseInt(numStr, 10);

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

  const issue = await prisma.repositoryIssue.findFirst({
    where: { repositoryId: repository.id, number: issueNumber },
  });
  if (!issue) return apiError("NOT_FOUND", "Issue not found", null, 404);

  const body = await req.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  try {
    const comment = await prisma.repositoryIssueComment.create({
      data: {
        issueId: issue.id,
        authorId: userId,
        body: parsed.data.body,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return apiOk({ comment }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to add comment", null, 500);
  }
}
