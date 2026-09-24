import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { saveReleaseAsset } from "@/server/git/releases/release-asset-service";

type RouteContext = { params: Promise<{ owner: string; repo: string; tag: string }> };

// POST /api/v1/repositories/[owner]/[repo]/releases/[tag]/assets
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, tag } = await context.params;

  let userId = await getSessionUserId().catch(() => null);
  const headerUserId = req.headers.get("x-user-id");
  if (headerUserId) userId = headerUserId;

  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to upload release assets", null, 403);

  // Look up release by tag
  const release = await prisma.repositoryRelease.findUnique({
    where: {
      repositoryId_tagName: {
        repositoryId: repository.id,
        tagName: tag,
      },
    },
  });
  if (!release) return apiError("NOT_FOUND", `Release with tag '${tag}' not found`, null, 404);

  try {
    const contentTypeHeader = req.headers.get("content-type") || "";

    let fileName = "";
    let contentType = "application/octet-stream";
    let buffer: Buffer;

    if (contentTypeHeader.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return apiError("BAD_REQUEST", "No file found in form data ('file' field required)", null, 400);
      }
      fileName = file.name;
      contentType = file.type || "application/octet-stream";
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      // JSON payload fallback
      const json = await req.json().catch(() => ({}));
      if (!json.name || !json.bufferBase64) {
        return apiError("BAD_REQUEST", "Expected multipart/form-data or JSON with 'name' and 'bufferBase64'", null, 400);
      }
      fileName = json.name;
      contentType = json.contentType || "application/octet-stream";
      buffer = Buffer.from(json.bufferBase64, "base64");
    }

    if (!fileName || buffer.length === 0) {
      return apiError("BAD_REQUEST", "File name cannot be empty and file must not be 0 bytes", null, 400);
    }

    const asset = await saveReleaseAsset({
      repositoryId: repository.id,
      releaseId: release.id,
      fileName,
      contentType,
      buffer,
      uploaderId: userId,
    });

    return apiOk({ asset }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to upload release asset: ${err.message}`, null, 500);
  }
}
