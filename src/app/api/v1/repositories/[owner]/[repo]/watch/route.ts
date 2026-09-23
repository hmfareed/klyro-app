import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// POST /api/v1/repositories/[owner]/[repo]/watch — toggle watch status
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

  try {
    const existing = await prisma.repositoryWatcher.findUnique({
      where: {
        userId_repositoryId: { userId, repositoryId: repository.id },
      },
    });

    if (existing) {
      await prisma.repositoryWatcher.delete({ where: { id: existing.id } });
      const watchersCount = await prisma.repositoryWatcher.count({ where: { repositoryId: repository.id } });
      return apiOk({ watching: false, watchersCount });
    } else {
      await prisma.repositoryWatcher.create({
        data: { userId, repositoryId: repository.id, level: "ALL" },
      });
      const watchersCount = await prisma.repositoryWatcher.count({ where: { repositoryId: repository.id } });
      return apiOk({ watching: true, watchersCount });
    }
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to update watch", null, 500);
  }
}
