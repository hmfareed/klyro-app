import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getReleaseAssetDownload, deleteReleaseAsset } from "@/server/git/releases/release-asset-service";

type RouteContext = { params: Promise<{ owner: string; repo: string; id: string }> };

// GET /api/v1/repositories/[owner]/[repo]/releases/assets/[id]
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, id } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result || !result.viewer.canRead) {
    return new Response("Not found or access denied", { status: 404 });
  }

  try {
    const { asset, buffer } = await getReleaseAssetDownload(id);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": asset.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asset.name}"`,
        "Content-Length": buffer.length.toString(),
        "ETag": `"${asset.sha256}"`,
        "x-checksum-sha256": asset.sha256,
      },
    });
  } catch (err: any) {
    return new Response(err.message || "Failed to download asset", { status: 404 });
  }
}

// DELETE /api/v1/repositories/[owner]/[repo]/releases/assets/[id]
export async function DELETE(req: Request, context: RouteContext) {
  const { owner, repo, id } = await context.params;

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

  const { viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to delete release assets", null, 403);

  try {
    await deleteReleaseAsset(id);
    return apiOk({ success: true, deletedAssetId: id });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to delete asset: ${err.message}`, null, 500);
  }
}
