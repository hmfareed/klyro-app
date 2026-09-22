import { prisma } from "@/shared/db/prisma";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/users/:username — public profile (04). Email/real name/location
// never shown unless the user added them; unlisted/private handled in later phases.
export async function GET(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const user = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: {
      username: true, displayName: true, avatarUrl: true, bio: true, about: true,
      location: true, websiteUrl: true, githubUsername: true, createdAt: true,
      skills: { include: { skill: true } },
    },
  });
  if (!user) return apiError("NOT_FOUND", "User not found.", null, 404);
  return apiOk({ user });
}
