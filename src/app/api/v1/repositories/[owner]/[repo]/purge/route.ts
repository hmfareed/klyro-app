import { z } from "zod";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { purgeRepositoryPermanently } from "@/server/repositories/repo-lifecycle";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

const purgeSchema = z.object({
  confirmationName: z.string().min(1),
});

// POST /api/v1/repositories/[owner]/[repo]/purge — immediate permanent delete
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.isOwner || !viewer.userId) {
    return apiError("FORBIDDEN", "Only the owner can permanently purge this repository", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = purgeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  if (
    parsed.data.confirmationName.trim().toLowerCase() !== repository.name.trim().toLowerCase() &&
    parsed.data.confirmationName.trim().toLowerCase() !== repository.slug.toLowerCase()
  ) {
    return apiError("CONFIRMATION_MISMATCH", `You must type '${repository.name}' exactly.`, "confirmationName", 400);
  }

  await purgeRepositoryPermanently({ repository, actorId: viewer.userId, req });

  return apiOk({ success: true, purged: true });
}
