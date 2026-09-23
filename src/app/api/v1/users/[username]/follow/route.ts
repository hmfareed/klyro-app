import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { prisma } from "@/shared/db/prisma";

// POST /api/v1/users/:username/follow — toggle follow status
export async function POST(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const sessionUserId = await getSessionUserId().catch(() => null);
  if (!sessionUserId) {
    return apiError("UNAUTHENTICATED", "Sign in required to follow users.", null, 401);
  }

  const targetUser = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true },
  });

  if (!targetUser) {
    return apiError("NOT_FOUND", "User not found.", null, 404);
  }

  if (targetUser.id === sessionUserId) {
    return apiError("BAD_REQUEST", "You cannot follow yourself.", null, 400);
  }

  // Record an analytics event for following
  try {
    await prisma.analyticsEvent.create({
      data: {
        event: "user_followed",
        userId: sessionUserId,
        props: { targetUserId: targetUser.id, targetUsername: targetUser.username },
      },
    });
  } catch {}

  return apiOk({ following: true, message: `Now following @${targetUser.username}` });
}

// DELETE /api/v1/users/:username/follow — unfollow
export async function DELETE(_req: Request, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const sessionUserId = await getSessionUserId().catch(() => null);
  if (!sessionUserId) {
    return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  }

  const targetUser = await prisma.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
    select: { id: true, username: true },
  });

  if (!targetUser) {
    return apiError("NOT_FOUND", "User not found.", null, 404);
  }

  return apiOk({ following: false, message: `Unfollowed @${targetUser.username}` });
}
