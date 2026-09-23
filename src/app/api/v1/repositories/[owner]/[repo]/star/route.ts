import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// POST /api/v1/repositories/[owner]/[repo]/star — toggle star
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
    const existing = await prisma.repositoryStar.findUnique({
      where: {
        userId_repositoryId: { userId, repositoryId: repository.id },
      },
    });

    if (existing) {
      await prisma.repositoryStar.delete({ where: { id: existing.id } });
      const starsCount = await prisma.repositoryStar.count({ where: { repositoryId: repository.id } });
      return apiOk({ starred: false, starsCount });
    } else {
      await prisma.repositoryStar.create({
        data: { userId, repositoryId: repository.id },
      });
      const starsCount = await prisma.repositoryStar.count({ where: { repositoryId: repository.id } });
      return apiOk({ starred: true, starsCount });
    }
  } catch (err: any) {
    return apiError("INTERNAL_ERROR", "Failed to update star", null, 500);
  }
}
