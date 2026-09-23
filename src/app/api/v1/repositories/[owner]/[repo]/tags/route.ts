import { z } from "zod";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getTags, createTag } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/tags
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  try {
    const tags = await getTags(repository.gitStoragePath);
    return apiOk({ tags });
  } catch (err: any) {
    return apiError("GIT_ERROR", err.message || "Failed to list tags", null, 500);
  }
}

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  targetRef: z.string().optional(),
  message: z.string().optional(),
});

// POST /api/v1/repositories/[owner]/[repo]/tags
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to create tags", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { name, message } = parsed.data;
  const targetRef = parsed.data.targetRef || repository.defaultBranch || "main";

  try {
    await createTag(repository.gitStoragePath, name, targetRef, message || name);
    return apiOk({ success: true, tag: name, targetRef }, 201);
  } catch (err: any) {
    return apiError("GIT_ERROR", `Failed to create tag: ${err.message}`, null, 400);
  }
}
