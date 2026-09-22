import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { onboardingSchema } from "@/modules/auth/validation";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/users/me — current profile (Phase 0: name/avatar/bio/about/skills).
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, username: true, displayName: true, avatarUrl: true,
      bio: true, about: true, location: true, websiteUrl: true, githubUsername: true,
      isVerifiedEmail: true, createdAt: true,
      skills: { include: { skill: true } },
    },
  });
  if (!user) return apiError("NOT_FOUND", "Account not found.", null, 404);
  return apiOk({ user });
}

// PATCH /api/v1/users/me — onboarding steps 2-4 + settings profile (04 partial).
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const body = await req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }
  const { skills, intent: _intent, ...profile } = parsed.data;

  if (skills?.length) {
    for (const s of skills) {
      const skill = await prisma.skill.upsert({
        where: { name: s.name.toLowerCase().trim() },
        update: {},
        create: { name: s.name.toLowerCase().trim(), category: "engineering" },
      });
      await prisma.skillOnUser.upsert({
        where: { userId_skillId: { userId, skillId: skill.id } },
        update: { level: s.level },
        create: { userId, skillId: skill.id, level: s.level },
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: profile.displayName,
      bio: profile.bio,
      about: profile.about,
      location: profile.location,
      websiteUrl: profile.websiteUrl || undefined,
    },
    select: { id: true, username: true, displayName: true, bio: true },
  });
  return apiOk({ user });
}
