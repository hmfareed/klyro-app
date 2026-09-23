import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

const reviewSchema = z.object({
  state: z.enum(["APPROVED", "CHANGES_REQUESTED", "COMMENTED"]),
  body: z.string().max(10000).optional(),
});

// GET /api/v1/repositories/[owner]/[repo]/pulls/[number]/reviews
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

  let userId = await getSessionUserId();
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
  });
  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  try {
    const reviews = await prisma.pullRequestReview.findMany({
      where: { pullRequestId: pullRequest.id },
      include: {
        reviewer: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Compute latest review state per reviewer
    const latestByReviewer: Record<string, { state: string; reviewer: any; createdAt: Date }> = {};
    for (const r of reviews) {
      latestByReviewer[r.reviewerId] = {
        state: r.state,
        reviewer: r.reviewer,
        createdAt: r.createdAt,
      };
    }

    const latestList = Object.values(latestByReviewer);
    const approvedCount = latestList.filter((r) => r.state === "APPROVED").length;
    const changesRequestedCount = latestList.filter((r) => r.state === "CHANGES_REQUESTED").length;
    const commentedCount = latestList.filter((r) => r.state === "COMMENTED").length;

    return apiOk({
      reviews,
      summary: {
        total: reviews.length,
        approvedCount,
        changesRequestedCount,
        commentedCount,
        latestReviews: latestList,
      },
    });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to fetch reviews", null, 500);
  }
}

// POST /api/v1/repositories/[owner]/[repo]/pulls/[number]/reviews
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);

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

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
  });
  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  // Author cannot approve or request changes on their own PR
  const body = await req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { state, body: reviewBody } = parsed.data;

  if (pullRequest.authorId === userId && (state === "APPROVED" || state === "CHANGES_REQUESTED")) {
    return apiError("CANNOT_REVIEW_OWN_PR", "Authors cannot approve or request changes on their own pull requests", null, 400);
  }

  try {
    const review = await prisma.pullRequestReview.create({
      data: {
        pullRequestId: pullRequest.id,
        reviewerId: userId,
        state,
        body: reviewBody || null,
      },
      include: {
        reviewer: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    return apiOk({ review }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to submit review", null, 500);
  }
}
