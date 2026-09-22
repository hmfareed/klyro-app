import { prisma } from "@/shared/db/prisma";
import { hashPassword } from "@/shared/auth/passwords";
import { normalizeUsername } from "@/shared/auth/usernames";
import { signupSchema } from "@/modules/auth/validation";
import { isPasswordBreached } from "@/modules/auth/breach-check";
import { signVerifyToken } from "@/modules/auth/verify-token";
import { createSession } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { slidingWindow } from "@/shared/api/rate-limit";
import { enqueueVerificationEmail } from "@/server/queue";

// POST /api/v1/auth/signup — 03-auth email signup flow.
// Validates -> argon2id -> creates User(emailVerifiedAt=null) -> signed 24h
// token -> queue verify email -> session (pre-verification, restricted access
// enforced by callers checking isVerifiedEmail) -> resend limits 1/60s, 5/hr.
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const rl = await slidingWindow(`rl:signup:${ip}`, 10, 3600);
    if (!rl.allowed) return apiError("RATE_LIMITED", "Too many signup attempts. Try again later.", null, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be JSON.", null, 400);
  }
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input.", String(first?.path?.[0] ?? ""), 400);
  }
  const { email, password, username } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = normalizeUsername(username);

  // Resend-style guard: one verify email per 60s per address (5/hr enforced via same key family).
  const resendCheck = await slidingWindow(`rl:verify-send:${normalizedEmail}`, 5, 3600);
  if (!resendCheck.allowed) return apiError("RATE_LIMITED", "Too many verification emails. Try again later.", "email", 429);

  if (await isPasswordBreached(password)) {
    return apiError("PASSWORD_BREACHED", "That password appeared in a data breach. Please choose another.", "password", 400);
  }

  const emailTaken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (emailTaken) return apiError("EMAIL_TAKEN", "An account with that email already exists.", "email", 409);
  const usernameTaken = await prisma.user.findFirst({ where: { username: { equals: normalizedUsername, mode: "insensitive" } } });
  if (usernameTaken) return apiError("USERNAME_TAKEN", "That username is taken.", "username", 409);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username,
      passwordHash: await hashPassword(password),
    },
    select: { id: true, email: true, username: true },
  });

  const token = signVerifyToken(user.id, user.email);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await enqueueVerificationEmail(user.email, `${base}/api/v1/auth/verify?token=${token}`);
  await createSession(user.id, { userAgent: req.headers.get("user-agent") ?? undefined, ip });

    return apiOk({ user, verificationSent: true }, 201);
  } catch (err) {
    console.error("[klyro] signup failed:", (err as Error).message);
    return apiError("SERVER_ERROR", "Signup failed. Please try again.", null, 500);
  }
}
