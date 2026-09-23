import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/repositories/deleted — list user's repositories pending deletion
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to view deleted repositories", null, 401);
  }

  const repositories = await prisma.repository.findMany({
    where: {
      ownerId: userId,
      status: "DELETION_PENDING",
    },
    orderBy: { deletedAt: "desc" },
    include: {
      owner: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      project: {
        select: { id: true, title: true, slug: true },
      },
    },
  });

  const now = Date.now();
  const withRetention = repositories.map((r) => {
    const purgeTime = r.purgeAt ? new Date(r.purgeAt).getTime() : now + 30 * 24 * 60 * 60 * 1000;
    const daysRemaining = Math.max(0, Math.ceil((purgeTime - now) / (1000 * 60 * 60 * 24)));
    return {
      ...r,
      daysRemaining,
    };
  });

  return apiOk({ repositories: withRetention });
}
