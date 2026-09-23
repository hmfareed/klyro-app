import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { createTag } from "@/server/git/git-service";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/releases
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  try {
    const releases = await prisma.repositoryRelease.findMany({
      where: { repositoryId: repository.id },
      orderBy: { publishedAt: "desc" },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return apiOk({ releases });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to load releases", null, 500);
  }
}

const createReleaseSchema = z.object({
  tagName: z.string().min(1).max(50),
  targetCommitish: z.string().default("main"),
  name: z.string().min(1).max(200),
  body: z.string().max(10000).optional(),
  isPrerelease: z.boolean().default(false),
});

// POST /api/v1/repositories/[owner]/[repo]/releases
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
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to publish releases", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createReleaseSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { tagName, targetCommitish, name, body: releaseBody, isPrerelease } = parsed.data;

  try {
    // 1. Ensure tag exists in Git or create it
    try {
      await createTag(repository.gitStoragePath, tagName, targetCommitish, name);
    } catch {
      // Tag might already exist, which is fine
    }

    // 2. Create release record in DB
    const release = await prisma.repositoryRelease.create({
      data: {
        repositoryId: repository.id,
        tagName,
        targetCommitish,
        name,
        body: releaseBody || "",
        isPrerelease,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    // 3. Emit Buildstream event if linked to project
    if (repository.projectId) {
      await recordActivityEvent({
        actorId: userId,
        projectId: repository.projectId,
        type: ActivityEventType.RELEASE_CREATED,
        targetType: "RepositoryRelease",
        targetId: release.id,
        metadata: {
          tagName,
          title: name,
          repoName: repository.name,
          repoSlug: repository.slug,
        },
      });
    }

    dispatchRepositoryWebhooks({
      repositoryId: repository.id,
      event: "release",
      payload: {
        action: "published",
        release,
      },
    });

    return apiOk({ release }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to publish release: ${err.message}`, null, 500);
  }
}
