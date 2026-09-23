import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { requirePermission } from "@/shared/permissions/project";
import { apiError, apiOk } from "@/shared/api/errors";

const createFileSchema = z.object({
  fileName: z.string().min(1).max(255),
  storageKey: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

// GET /api/v1/projects/:slug/files — list project files
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const files = await prisma.fileAsset.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  return apiOk({ files });
}

// POST /api/v1/projects/:slug/files — record a file asset
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!project) return apiError("NOT_FOUND", "Project not found.", null, 404);

  const canUpload = await requirePermission(project.id, userId, "CONTRIBUTOR");
  if (!canUpload) return apiError("FORBIDDEN", "Only active team members can upload files.", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createFileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", null, 400);
  }

  const file = await prisma.fileAsset.create({
    data: {
      projectId: project.id,
      uploadedById: userId,
      fileName: parsed.data.fileName,
      storageKey: parsed.data.storageKey,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    },
    include: {
      uploadedBy: { select: { id: true, username: true, displayName: true } },
    },
  });

  return apiOk({ file }, 201);
}
