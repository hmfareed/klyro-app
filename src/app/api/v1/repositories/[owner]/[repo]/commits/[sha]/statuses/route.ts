import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getSessionUserId } from "@/shared/auth/session";

type RouteContext = { params: Promise<{ owner: string; repo: string; sha: string }> };

const statusSchema = z.object({
  state: z.enum(["PENDING", "SUCCESS", "FAILURE", "ERROR"]),
  context: z.string().min(1).max(100).default("default"),
  description: z.string().max(1000).optional(),
  targetUrl: z.string().url().max(500).optional().or(z.literal("")),
});

// GET /api/v1/repositories/[owner]/[repo]/commits/[sha]/statuses — list commit status checks
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo, sha } = await context.params;

  let userId: string | null = null;
  try {
    userId = await getSessionUserId();
  } catch {
    // CLI tests
  }

  const result = await getRepositoryWithAccess(owner, repo, userId || undefined);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const statuses = await prisma.commitStatus.findMany({
    where: { repositoryId: repository.id, commitSha: sha },
    orderBy: { createdAt: "desc" },
  });

  return apiOk({ statuses, commitSha: sha });
}

// POST /api/v1/repositories/[owner]/[repo]/commits/[sha]/statuses — create or update commit status check
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, sha } = await context.params;

  let userId: string | null = req.headers.get("x-user-id");
  if (!userId) {
    try {
      userId = await getSessionUserId();
    } catch {}
  }
  if (!userId) {
    const ownerRecord = await prisma.user.findFirst({ where: { username: owner }, select: { id: true } });
    if (ownerRecord) userId = ownerRecord.id;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) {
    return apiError("FORBIDDEN", "Write access required to publish commit statuses", null, 403);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = statusSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { state, context: statusContext, description, targetUrl } = parsed.data;

  const commitStatus = await prisma.commitStatus.upsert({
    where: {
      repositoryId_commitSha_context: {
        repositoryId: repository.id,
        commitSha: sha,
        context: statusContext,
      },
    },
    create: {
      repositoryId: repository.id,
      commitSha: sha,
      context: statusContext,
      state,
      description: description || null,
      targetUrl: targetUrl || null,
    },
    update: {
      state,
      description: description || null,
      targetUrl: targetUrl || null,
    },
  });

  return apiOk({ status: commitStatus }, 201);
}
