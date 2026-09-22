import { prisma } from "@/shared/db/prisma";
import { verifyPassword } from "@/shared/auth/passwords";
import { createSession, destroySession } from "@/shared/auth/session";
import { loginSchema } from "@/modules/auth/validation";
import { apiError, apiOk } from "@/shared/api/errors";
import { slidingWindow } from "@/shared/api/rate-limit";

// POST /api/v1/auth/login — strictest rate limit (auth sensitivity per 14).
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = await slidingWindow(`rl:login:${ip}`, 20, 900);
  if (!rl.allowed) return apiError("RATE_LIMITED", "Too many login attempts. Try again later.", null, 429);

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return apiError("INVALID_CREDENTIALS", "Email or password is incorrect.", null, 401);

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase().trim() } });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
    return apiError("INVALID_CREDENTIALS", "Email or password is incorrect.", null, 401);
  }
  if (user.status !== "ACTIVE") return apiError("ACCOUNT_DISABLED", "This account is deactivated.", null, 403);

  await createSession(user.id, { userAgent: req.headers.get("user-agent") ?? undefined, ip });
  return apiOk({ id: user.id, username: user.username, isVerifiedEmail: user.isVerifiedEmail });
}

// DELETE /api/v1/auth/login — logout (revokes current session).
export async function DELETE() {
  await destroySession();
  return apiOk({ loggedOut: true });
}
