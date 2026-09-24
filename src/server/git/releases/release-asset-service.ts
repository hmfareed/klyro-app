import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/shared/db/prisma";

export const RELEASES_STORAGE_ROOT =
  process.env.RELEASES_STORAGE_DIR || path.join(process.cwd(), "data", "releases");

export interface ReleaseAssetInfo {
  id: string;
  releaseId: string;
  name: string;
  size: number;
  contentType: string;
  downloadCount: number;
  sha256: string;
  createdAt: Date;
  uploadedBy: {
    id: string;
    username: string;
    displayName: string | null;
  };
}

/**
 * Save a binary release asset to disk and create DB record
 */
export async function saveReleaseAsset(options: {
  repositoryId: string;
  releaseId: string;
  fileName: string;
  contentType?: string;
  buffer: Buffer;
  uploaderId: string;
}): Promise<ReleaseAssetInfo> {
  const cleanName = path.basename(options.fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!cleanName || cleanName === "." || cleanName === "..") {
    throw new Error("Invalid asset file name");
  }

  // Calculate SHA-256 integrity checksum
  const sha256 = crypto.createHash("sha256").update(options.buffer).digest("hex");

  const dir = path.join(RELEASES_STORAGE_ROOT, options.repositoryId, options.releaseId);
  await fs.mkdir(dir, { recursive: true });

  // 1. Create DB record first to obtain UUID
  const asset = await prisma.repositoryReleaseAsset.create({
    data: {
      releaseId: options.releaseId,
      name: cleanName,
      size: options.buffer.length,
      contentType: options.contentType || "application/octet-stream",
      storagePath: "", // populated below
      sha256,
      uploadedById: options.uploaderId,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  });

  // 2. Persist binary to isolated storage location
  const filePath = path.join(dir, `${asset.id}_${cleanName}`);
  await fs.writeFile(filePath, options.buffer);

  // 3. Update storage path in DB
  await prisma.repositoryReleaseAsset.update({
    where: { id: asset.id },
    data: { storagePath: filePath },
  });

  return {
    id: asset.id,
    releaseId: asset.releaseId,
    name: asset.name,
    size: asset.size,
    contentType: asset.contentType,
    downloadCount: asset.downloadCount,
    sha256: asset.sha256,
    createdAt: asset.createdAt,
    uploadedBy: asset.uploadedBy,
  };
}

/**
 * Retrieve release asset and increment download counter
 */
export async function getReleaseAssetDownload(assetId: string): Promise<{
  asset: any;
  buffer: Buffer;
}> {
  const asset = await prisma.repositoryReleaseAsset.findUnique({
    where: { id: assetId },
    include: {
      release: {
        include: {
          repository: true,
        },
      },
    },
  });

  if (!asset) {
    throw new Error("Release asset not found");
  }

  // Read file from disk
  const buffer = await fs.readFile(asset.storagePath);

  // Increment download count atomically
  await prisma.repositoryReleaseAsset.update({
    where: { id: assetId },
    data: { downloadCount: { increment: 1 } },
  }).catch(() => {});

  return { asset, buffer };
}

/**
 * Delete a release asset from storage and DB
 */
export async function deleteReleaseAsset(assetId: string): Promise<void> {
  const asset = await prisma.repositoryReleaseAsset.findUnique({
    where: { id: assetId },
  });

  if (!asset) return;

  // Remove physical file
  if (asset.storagePath) {
    await fs.rm(asset.storagePath, { force: true }).catch(() => {});
  }

  // Delete DB record
  await prisma.repositoryReleaseAsset.delete({
    where: { id: assetId },
  });
}
