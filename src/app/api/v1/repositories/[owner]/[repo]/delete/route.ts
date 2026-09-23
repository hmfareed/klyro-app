import { z } from "zod";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { scheduleRepositoryDeletion } from "@/server/repositories/repo-lifecycle";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

const deleteSchema = z.object({
  confirmationName: z.string().min(1),
  cancelActiveWorkflows: z.boolean().default(true),
});

// POST /api/v1/repositories/[owner]/[repo]/delete — schedule soft deletion with 30-day retention
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.isOwner || !viewer.userId) {
    return apiError("FORBIDDEN", "Only the repository owner can schedule deletion", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const outcome = await scheduleRepositoryDeletion({
    repository,
    actorId: viewer.userId,
    confirmationName: parsed.data.confirmationName,
    cancelActiveWorkflows: parsed.data.cancelActiveWorkflows,
    req,
  });

  if (!outcome.success) {
    return apiError("CONFIRMATION_MISMATCH", outcome.message, "confirmationName", 400);
  }

  return apiOk({
    success: true,
    repository: outcome.repository,
    purgeAt: outcome.purgeAt,
    daysRemaining: outcome.daysRemaining,
  });
}
