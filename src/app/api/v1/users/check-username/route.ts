import { prisma } from "@/shared/db/prisma";
import { usernameSchema, suggestUsernames } from "@/shared/auth/usernames";
import { apiOk } from "@/shared/api/errors";

// GET /api/v1/users/check-username?username=foo — 30 §4 Screen 3 live validation.
// Returns { available, suggestions? } — never leaks who owns a name.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("username") ?? "").trim();
  const parsed = usernameSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid username.";
    return apiOk({ available: false, reason: msg, suggestions: [] });
  }
  const taken = await prisma.user.findFirst({
    where: { username: { equals: raw, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) return apiOk({ available: false, reason: "That username is taken.", suggestions: suggestUsernames(raw) });
  return apiOk({ available: true, suggestions: [] });
}
