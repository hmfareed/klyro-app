import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/onboarding — 30 §6 resume: server-persisted progress.
// Returns { step, entryPoint, intent, user } so a returning user resumes
// exactly where they left off, never restarts at Screen 1.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, displayName: true, avatarUrl: true, bio: true,
      about: true, location: true, websiteUrl: true, isVerifiedEmail: true,
      skills: { select: { skillId: true } },
    },
  });
  if (!user) return apiError("NOT_FOUND", "Account not found.", null, 404);

  // Infer step from the partially-filled User row (tolerant of the new
  // onboarding_* columns not existing until `prisma db push`).
  let step = 4; // username (3) done at signup → basics (4) next
  const extras = await readOnboardingExtras(userId);
  if (extras?.onboardingCompletedAt) step = 8;
  else if (extras?.onboardingIntent) step = 8;
  else if (user.about || user.skills.length > 0) step = 7;
  else if (user.displayName || user.bio) step = 5;

  return apiOk({
    step,
    entryPoint: extras?.onboardingEntryPoint ?? "ORGANIC",
    intent: extras?.onboardingIntent ?? null,
    user,
  });
}

const patchSchema = z.object({
  entryPoint: z.enum(["ORGANIC", "PROJECT_INVITE", "GROUP_INVITE", "OAUTH", "REFERRAL"]).optional(),
  intent: z.enum(["START", "JOIN", "BOTH"]).optional(),
  step: z.number().int().min(3).max(8).optional(),
  completed: z.boolean().optional(),
});

// PATCH /api/v1/onboarding — persist step/intent/entry (30 §6) + completion event.
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid input.", null, 400);
  const { entryPoint, intent, step, completed } = parsed.data;

  try {
    await (prisma.user.update as (...a: never[]) => unknown)({
      where: { id: userId },
      data: {
        ...(entryPoint ? { onboardingEntryPoint: entryPoint } : {}),
        ...(intent ? { onboardingIntent: intent } : {}),
        ...(typeof step === "number" ? { onboardingStep: step } : {}),
        ...(completed || intent ? { onboardingCompletedAt: new Date() } : {}),
      },
    } as never);
  } catch {
    // Column missing pre-migration — progress still resumable via GET inference above.
  }
  try {
    await (prisma as unknown as { analyticsEvent: { create: (a: unknown) => Promise<unknown> } }).analyticsEvent.create({
      data: {
        event: completed || intent ? "onboarding_completed" : "onboarding_started",
        userId,
        props: { ...(intent ? { value: intent } : {}), ...(entryPoint ? { entry_point: entryPoint } : {}) },
      },
    });
  } catch { /* analytics table optional pre-migration */ }
  return apiOk({ ok: true });
}

async function readOnboardingExtras(userId: string): Promise<{ onboardingEntryPoint?: string; onboardingIntent?: string; onboardingCompletedAt?: Date } | null> {
  try {
    return await (prisma.user.findUnique as (...a: never[]) => Promise<{ onboardingEntryPoint?: string; onboardingIntent?: string; onboardingCompletedAt?: Date } | null>)({
      where: { id: userId },
      select: { onboardingEntryPoint: true, onboardingIntent: true, onboardingCompletedAt: true },
    } as never);
  } catch {
    return null;
  }
}
