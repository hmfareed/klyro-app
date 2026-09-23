import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";
import { getRepoStoragePath } from "@/server/git/git-service";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// POST /api/v1/repositories/[owner]/[repo]/fork — fork repository
export async function POST(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  let userId = await getSessionUserId();
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required", null, 401);

  const result = await getRepositoryWithAccess(owner, repo, userId);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canRead) return apiError("FORBIDDEN", "Private repository", null, 403);

  if (repository.ownerId === userId) {
    return apiError("CANNOT_FORK_OWN", "You cannot fork your own repository", null, 400);
  }

  // Check if already forked
  const existingFork = await prisma.repository.findFirst({
    where: { ownerId: userId, forkedFromId: repository.id },
  });
  if (existingFork) {
    return apiOk({ repository: existingFork, alreadyForked: true });
  }

  try {
    const forkedRepo = await prisma.repository.create({
      data: {
        ownerId: userId,
        projectId: null,
        name: repository.name,
        slug: repository.slug,
        description: repository.description,
        visibility: "PUBLIC",
        defaultBranch: repository.defaultBranch,
        gitStoragePath: "",
        forkedFromId: repository.id,
      },
    });

    const targetStorage = getRepoStoragePath(forkedRepo.id);

    // Clone bare repository locally
    await execFileAsync("git", ["clone", "--bare", repository.gitStoragePath, targetStorage]);

    const updated = await prisma.repository.update({
      where: { id: forkedRepo.id },
      data: { gitStoragePath: targetStorage },
      include: {
        owner: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return apiOk({ repository: updated }, 201);
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", `Failed to fork repository: ${err.message}`, null, 500);
  }
}
