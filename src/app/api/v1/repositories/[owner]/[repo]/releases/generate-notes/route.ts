import { z } from "zod";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { generateReleaseNotes } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

const generateNotesSchema = z.object({
  tagName: z.string().min(1),
  targetCommitish: z.string().optional(),
  previousTag: z.string().optional(),
});

// POST /api/v1/repositories/[owner]/[repo]/releases/generate-notes
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  const body = await req.json().catch(() => ({}));
  const parsed = generateNotesSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { tagName, targetCommitish, previousTag } = parsed.data;
  const targetRef = targetCommitish || repository.defaultBranch || "main";

  try {
    const generated = await generateReleaseNotes(repository.gitStoragePath, targetRef, previousTag);
    return apiOk({
      tagName,
      targetCommitish: targetRef,
      ...generated,
    });
  } catch (err: any) {
    return apiError("GIT_ERROR", err.message || "Failed to generate release notes", null, 500);
  }
}
