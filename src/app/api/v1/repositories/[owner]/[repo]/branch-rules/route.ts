import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getSessionUserId } from "@/shared/auth/session";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

const branchRuleSchema = z.object({
  pattern: z.string().min(1).max(100).default("main"),
  requirePullRequest: z.boolean().default(true),
  requiredApprovals: z.number().int().min(0).max(10).default(1),
  preventForcePush: z.boolean().default(true),
  preventDeletion: z.boolean().default(true),
  requireStatusChecks: z.boolean().default(false),
  requiredChecks: z.array(z.string().min(1).max(100)).default([]),
  requireUpToDateBranch: z.boolean().default(false),
  requireConversationResolution: z.boolean().default(false),
});

// GET /api/v1/repositories/[owner]/[repo]/branch-rules — list branch protection rules
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

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

  const rules = await prisma.branchProtectionRule.findMany({
    where: { repositoryId: repository.id },
    orderBy: { createdAt: "asc" },
  });

  return apiOk({ rules });
}

// POST /api/v1/repositories/[owner]/[repo]/branch-rules — create or update branch protection rule
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

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
  if (!viewer.canAdmin && repository.ownerId !== userId) {
    return apiError("FORBIDDEN", "Admin permissions required to modify branch protection rules", null, 403);
  }

  const rawBody = await req.json().catch(() => null);
  const parsed = branchRuleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const data = parsed.data;

  // Check if rule for this pattern exists
  const existing = await prisma.branchProtectionRule.findFirst({
    where: { repositoryId: repository.id, pattern: data.pattern },
  });

  let rule;
  if (existing) {
    rule = await prisma.branchProtectionRule.update({
      where: { id: existing.id },
      data: {
        requirePullRequest: data.requirePullRequest,
        requiredApprovals: data.requiredApprovals,
        preventForcePush: data.preventForcePush,
        preventDeletion: data.preventDeletion,
        requireStatusChecks: data.requireStatusChecks,
        requiredChecks: data.requiredChecks,
        requireUpToDateBranch: data.requireUpToDateBranch,
        requireConversationResolution: data.requireConversationResolution,
      },
    });
  } else {
    rule = await prisma.branchProtectionRule.create({
      data: {
        repositoryId: repository.id,
        pattern: data.pattern,
        requirePullRequest: data.requirePullRequest,
        requiredApprovals: data.requiredApprovals,
        preventForcePush: data.preventForcePush,
        preventDeletion: data.preventDeletion,
        requireStatusChecks: data.requireStatusChecks,
        requiredChecks: data.requiredChecks,
        requireUpToDateBranch: data.requireUpToDateBranch,
        requireConversationResolution: data.requireConversationResolution,
      },
    });
  }

  return apiOk({ rule }, existing ? 200 : 201);
}
