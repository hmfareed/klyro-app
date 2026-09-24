import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { createTag } from "@/server/git/git-service";
import { recordActivityEvent } from "@/server/events";
import { ActivityEventType } from "@/generated/prisma";
import { dispatchRepositoryWebhooks } from "@/server/webhooks/webhook-dispatcher";
import { saveReleaseAsset } from "@/server/git/releases/release-asset-service";

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
        assets: {
          select: {
            id: true,
            name: true,
            size: true,
            contentType: true,
            downloadCount: true,
            sha256: true,
            createdAt: true,
            uploadedBy: { select: { id: true, username: true, displayName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
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
  body: z.string().max(20000).optional(),
  isDraft: z.boolean().default(false),
  isPrerelease: z.boolean().default(false),
  assets: z
    .array(
      z.object({
        name: z.string().min(1),
        contentType: z.string().optional(),
        bufferBase64: z.string().min(1),
      })
    )
    .optional(),
});

// POST /api/v1/repositories/[owner]/[repo]/releases
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  let userId = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;

  if (!userId) {
    const repoOwner = await prisma.repository.findFirst({
      where: { slug: repo, owner: { username: owner } },
      select: { ownerId: true },
    });
    if (repoOwner) userId = repoOwner.ownerId;
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

  const { tagName, targetCommitish, name, body: releaseBody, isDraft, isPrerelease, assets: rawAssets } = parsed.data;

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
        isDraft,
        isPrerelease,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    // 3. Process attached binary assets if supplied
    if (rawAssets && rawAssets.length > 0) {
      for (const assetInput of rawAssets) {
        try {
          const buf = Buffer.from(assetInput.bufferBase64, "base64");
          await saveReleaseAsset({
            repositoryId: repository.id,
            releaseId: release.id,
            fileName: assetInput.name,
            contentType: assetInput.contentType,
            buffer: buf,
            uploaderId: userId,
          });
        } catch {}
      }
    }

    // Re-fetch complete release with assets
    const fullRelease = await prisma.repositoryRelease.findUnique({
      where: { id: release.id },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        assets: {
          select: {
            id: true,
            name: true,
            size: true,
            contentType: true,
            downloadCount: true,
            sha256: true,
            createdAt: true,
            uploadedBy: { select: { id: true, username: true, displayName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // 4. Emit Buildstream event if linked to project
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
      }).catch(() => {});
    }

    dispatchRepositoryWebhooks({
      repositoryId: repository.id,
      event: "release",
      payload: {
        action: "published",
        release: fullRelease || release,
      },
    });

    return apiOk({ release: fullRelease || release }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to publish release: ${err.message}`, null, 500);
  }
}
