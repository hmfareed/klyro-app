import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";
import { getRepositoryWithAccess } from "@/server/repositories/repo-access";

type RouteContext = { params: Promise<{ owner: string; repo: string }> };

// GET /api/v1/repositories/[owner]/[repo]/audit-log
export async function GET(req: Request, context: RouteContext) {
  const { owner, repo } = await context.params;

  const result = await getRepositoryWithAccess(owner, repo);
  if (!result) return apiError("NOT_FOUND", "Repository not found", null, 404);

  const { repository, viewer } = result;
  if (!viewer.canAdmin) {
    return apiError("FORBIDDEN", "Admin permissions required to view repository audit log", null, 403);
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);

  const events = await prisma.repositoryAuditEvent.findMany({
    where: { repositoryId: repository.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return apiOk({ events });
}
