import { z } from "zod";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getBranches, createBranch, deleteBranch } from "@/server/git/git-service";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/branches
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  try {
    const branches = await getBranches(repository.gitStoragePath, repository.defaultBranch);
    return apiOk({ branches, defaultBranch: repository.defaultBranch });
  } catch (err: any) {
    return apiError("GIT_ERROR", err.message || "Failed to list branches", null, 500);
  }
}

const createBranchSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9/._-]+$/, "Invalid branch name format"),
  fromRef: z.string().optional(),
});

// POST /api/v1/repositories/[owner]/[repo]/branches — create new branch
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required to create branches", null, 403);

  const body = await req.json().catch(() => null);
  const parsed = createBranchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message || "Invalid input", null, 400);
  }

  const { name } = parsed.data;
  const fromRef = parsed.data.fromRef || repository.defaultBranch || "main";

  try {
    await createBranch(repository.gitStoragePath, name, fromRef);
    return apiOk({ success: true, branch: name, fromRef }, 201);
  } catch (err: any) {
    return apiError("GIT_ERROR", `Failed to create branch: ${err.message}`, null, 400);
  }
}

// DELETE /api/v1/repositories/[owner]/[repo]/branches?name=branch-name
export async function DELETE(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canWrite) return apiError("FORBIDDEN", "Write access required", null, 403);

  const url = new URL(req.url);
  const branchName = url.searchParams.get("name");

  if (!branchName) {
    return apiError("MISSING_BRANCH", "Branch name required", "name", 400);
  }

  if (branchName === repository.defaultBranch) {
    return apiError("CANNOT_DELETE_DEFAULT", "Cannot delete the default branch", null, 400);
  }

  try {
    await deleteBranch(repository.gitStoragePath, branchName);
    return apiOk({ success: true, deleted: branchName });
  } catch (err: any) {
    return apiError("GIT_ERROR", `Failed to delete branch: ${err.message}`, null, 400);
  }
}
