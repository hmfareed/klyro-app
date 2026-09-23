import { z } from "zod";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { setRepositoryArchiveState } from "@/server/repositories/repo-lifecycle";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

const archiveSchema = z.object({
  archived: z.boolean(),
});

// POST /api/v1/repositories/[owner]/[repo]/archive
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin || !viewer.userId) {
    return apiError("FORBIDDEN", "Admin permissions required to archive repository", null, 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = archiveSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const outcome = await setRepositoryArchiveState({
    repository,
    actorId: viewer.userId,
    archived: parsed.data.archived,
    req,
  });

  return apiOk({ repository: outcome.repository });
}
