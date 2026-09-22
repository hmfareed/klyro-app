import { prisma } from "@/shared/db/prisma";
import { parseVerifyToken } from "@/modules/auth/verify-token";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/auth/verify?token=… — 03-auth. Single-use: flips
// isVerifiedEmail/emailVerifiedAt; replay after verification is success no-op.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return apiError("MISSING_TOKEN", "Verification token is required.", null, 400);
  const parsed = parseVerifyToken(token);
  if (!parsed) return apiError("INVALID_TOKEN", "That link is invalid or expired. Request a new one.", null, 400);

  const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
  if (!user || user.email.toLowerCase() !== parsed.email.toLowerCase()) {
    return apiError("INVALID_TOKEN", "That link is invalid or expired. Request a new one.", null, 400);
  }
  if (!user.isVerifiedEmail) {
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerifiedEmail: true, emailVerifiedAt: new Date() },
    });
  }
  // Redirect to onboarding step 1 (username already set at signup; profile basics next).
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return Response.redirect(`${base}/onboarding?verified=1`, 302);
}

export async function POST() {
  return apiOk({ hint: "Use GET /api/v1/auth/verify?token=… from the email link." });
}
