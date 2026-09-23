import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/users/:username — full profile with projects, memberships, skills, and stats.
export async function GET(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const sessionUserId = await getSessionUserId().catch(() => null);

  try {
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        about: true,
        location: true,
        websiteUrl: true,
        githubUsername: true,
        createdAt: true,
        skills: {
          include: { skill: true },
        },
        projectsOwned: {
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            slug: true,
            title: true,
            tagline: true,
            description: true,
            category: true,
            status: true,
            visibility: true,
            techStack: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: { members: true },
            },
          },
        },
        memberships: {
          where: { status: "ACTIVE" },
          orderBy: { joinedAt: "desc" },
          select: {
            id: true,
            joinedAt: true,
            role: {
              select: {
                title: true,
                permissionLevel: true,
              },
            },
            project: {
              select: {
                id: true,
                slug: true,
                title: true,
                tagline: true,
                status: true,
                visibility: true,
                techStack: true,
                updatedAt: true,
                _count: {
                  select: { members: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) return apiError("NOT_FOUND", "User not found.", null, 404);

    const isOwner = Boolean(sessionUserId && sessionUserId === user.id);

    // Compute profile stats
    const totalRepos = (user.projectsOwned?.length || 0) + (user.memberships?.length || 0);
    const contributionsCount = (user.projectsOwned?.length || 0) * 3 + (user.memberships?.length || 0) * 2;

    return apiOk({
      user: {
        ...user,
        isOwner,
        stats: {
          repositoriesCount: totalRepos,
          followersCount: 0,
          followingCount: 0,
          contributionsCount,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return apiError("SERVER_ERROR", "Failed to fetch user profile.", null, 500);
  }
}
