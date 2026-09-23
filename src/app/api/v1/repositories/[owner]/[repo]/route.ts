import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getBranches } from "@/server/git/git-service";
import fs from "node:fs/promises";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) {
    return apiError("NOT_FOUND", "Repository not found", null, 404);
  }

  const { repository, viewer } = result;

  if (!viewer.canRead) {
    return apiError("FORBIDDEN", "This repository is private.", null, 403);
  }

  // Get branches list from Git
  let branches: any[] = [];
  try {
    branches = await getBranches(repository.gitStoragePath, repository.defaultBranch);
  } catch {}

  return apiOk({
    repository: {
      ...repository,
      branches,
    },
    viewer,
  });
}

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(1000).optional(),
  defaultBranch: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  archived: z.boolean().optional(),
});

// PATCH /api/v1/repositories/[owner]/[repo] — update settings
export async function PATCH(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin) {
    return apiError("FORBIDDEN", "Admin permissions required to modify repository settings", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  try {
    const updated = await prisma.repository.update({
      where: { id: repository.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.defaultBranch ? { defaultBranch: parsed.data.defaultBranch } : {}),
        ...(parsed.data.visibility ? { visibility: parsed.data.visibility } : {}),
        ...(parsed.data.archived !== undefined ? { archived: parsed.data.archived } : {}),
      },
    });

    return apiOk({ repository: updated });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to update repository", null, 500);
  }
}

// DELETE /api/v1/repositories/[owner]/[repo] — delete repository with name confirmation
export async function DELETE(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.isOwner) {
    return apiError("FORBIDDEN", "Only the owner can delete this repository", null, 403);
  }

  const url = new URL(req.url);
  const confirmName = url.searchParams.get("confirmName");
  if (confirmName !== repository.name) {
    return apiError("CONFIRMATION_REQUIRED", `You must type '${repository.name}' to confirm deletion.`, null, 400);
  }

  try {
    // Delete bare git directory
    await fs.rm(repository.gitStoragePath, { recursive: true, force: true }).catch(() => {});

    // Delete DB record (cascades to issues, PRs, etc.)
    await prisma.repository.delete({ where: { id: repository.id } });

    return apiOk({ success: true });
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to delete repository", null, 500);
  }
}
