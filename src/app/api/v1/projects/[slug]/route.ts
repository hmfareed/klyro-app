import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/projects/:slug — real project for the workspace view.
// Only owner/members (or PUBLIC) can see it — never mock data.
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, tagline: true, description: true,
      category: true, status: true, visibility: true, ownerId: true,
      createdAt: true, updatedAt: true,
      owner: { select: { username: true, displayName: true } },
      members: { select: { userId: true, user: { select: { username: true, displayName: true } } } },
      _count: { select: { members: true, roles: true } },
    },
  });
  if (!project) return apiError("NOT_FOUND", "Repository not found.", null, 404);
  const isMember = project.ownerId === userId || project.members.some((m) => m.userId === userId);
  if (project.visibility !== "PUBLIC" && !isMember) return apiError("FORBIDDEN", "You don't have access to this repository.", null, 403);
  return apiOk({ project });
}
