import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { mergeBranches } from "@/server/git/git-service";
import { getSessionUserId } from "@/shared/auth/session";

type RouteContext = { params: Promise<{ owner: string; repo: string; number: string }> };

// POST /api/v1/repositories/[owner]/[repo]/pulls/[number]/update-branch
// Merges baseBranch into headBranch to bring headBranch up to date
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo, number: numStr } = await context.params;
  const prNumber = parseInt(numStr, 10);
  if (isNaN(prNumber)) return apiError("INVALID_NUMBER", "Invalid pull request number", null, 400);

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
    return apiError("FORBIDDEN", "Write access required to update branch", null, 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true, email: true },
  });
  if (!user) return apiError("NOT_FOUND", "User not found", null, 404);

  const pullRequest = await prisma.pullRequest.findFirst({
    where: { repositoryId: repository.id, number: prNumber },
  });
  if (!pullRequest) return apiError("NOT_FOUND", "Pull request not found", null, 404);

  if (pullRequest.status !== "OPEN") {
    return apiError("NOT_OPEN", "Can only update branches for open pull requests", null, 400);
  }

  try {
    // Merge baseBranch into headBranch
    const updateResult = await mergeBranches(
      repository.gitStoragePath,
      pullRequest.headBranch, // target branch to receive updates
      pullRequest.baseBranch, // source branch to merge from
      `Merge branch '${pullRequest.baseBranch}' into ${pullRequest.headBranch}`,
      {
        name: user.displayName || user.username,
        email: user.email,
      }
    );

    if (!updateResult.success || !updateResult.commitSha) {
      return apiError(
        "UPDATE_BRANCH_FAILED",
        updateResult.error || "Failed to merge base branch into head branch",
        null,
        400
      );
    }

    // Touch PR updated at
    await prisma.pullRequest.update({
      where: { id: pullRequest.id },
      data: { updatedAt: new Date() },
    });

    return apiOk({
      success: true,
      commitSha: updateResult.commitSha,
      message: `Successfully merged '${pullRequest.baseBranch}' into '${pullRequest.headBranch}'`,
    });
  } catch (err: any) {
    return apiError("UPDATE_BRANCH_ERROR", err.message || "Error updating branch", null, 500);
  }
}
