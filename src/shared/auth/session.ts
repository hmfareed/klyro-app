import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/shared/db/prisma";

const COOKIE = process.env.SESSION_COOKIE_NAME ?? "klyro_session";
// 03-auth: sliding 30d, absolute 90d. DB-backed revocable sessions (not stateless JWT).
const SLIDING_MS = 30 * 24 * 3600 * 1000;
const ABSOLUTE_MS = 90 * 24 * 3600 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      userAgent: meta?.userAgent,
      ip: meta?.ip,
      expiresAt: new Date(Math.min(now + SLIDING_MS, now + ABSOLUTE_MS)),
    },
  });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return session;
}

export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  // Fail closed (deny) when the DB is unreachable: treat as unauthenticated
  // instead of throwing a 500 into every route (Rules §2, §46 offline handling).
  let session;
  try {
    session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  } catch (err) {
    console.error("[auth] session lookup failed — db unreachable?", (err as Error)?.message ?? err);
    return null;
  }
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  // Sliding renewal: extend up to absolute cap (createdAt + 90d).
  const cap = session.createdAt.getTime() + ABSOLUTE_MS;
  const next = new Date(Math.min(Date.now() + SLIDING_MS, cap));
  if (next.getTime() - session.expiresAt.getTime() > 24 * 3600 * 1000) {
    try {
      await prisma.session.update({ where: { id: session.id }, data: { expiresAt: next } });
    } catch (err) {
      console.error("[auth] session renewal failed — db unreachable?", (err as Error)?.message ?? err);
    }
  }
  return session.userId;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  store.delete(COOKIE);
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}
