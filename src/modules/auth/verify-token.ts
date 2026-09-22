import { createHmac, timingSafeEqual } from "crypto";

// 03-auth email verification: signed 24h single-use token.
// Payload: base64url({ uid, email, exp, nonce }). Single-use enforced by
// flipping User.emailVerifiedAt/isVerifiedEmail (replay of same token is a no-op success).
const SECRET = () => {
  const s = process.env.EMAIL_VERIFY_SECRET;
  if (!s || s.length < 32) throw new Error("EMAIL_VERIFY_SECRET must be >= 32 chars");
  return s;
};

export function signVerifyToken(userId: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, email, exp: Date.now() + 24 * 3600 * 1000, nonce: Math.random().toString(36).slice(2) }),
  ).toString("base64url");
  const sig = createHmac("sha256", SECRET()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function parseVerifyToken(token: string): { userId: string; email: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", SECRET()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { userId: data.uid, email: data.email };
  } catch {
    return null;
  }
}
