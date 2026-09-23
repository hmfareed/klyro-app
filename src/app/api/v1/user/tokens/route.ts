import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { generatePersonalAccessToken } from "@/server/auth/pat-service";

const createTokenSchema = z.object({
  name: z.string().min(1, "Token name is required").max(60, "Name must be at most 60 characters"),
  scopes: z.array(z.string()).default(["repo:read", "repo:write"]),
  expirationDays: z.number().int().min(1).max(365).nullable().optional(),
});

// GET /api/v1/user/tokens — List the authenticated user's active personal access tokens
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to view personal access tokens", null, 401);
  }

  try {
    const tokens = await prisma.personalAccessToken.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        scopes: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return apiOk({ tokens });
  } catch (err: any) {
    console.error("[Tokens API] Error loading tokens:", err);
    return apiError("INTERNAL_ERROR", "Failed to retrieve tokens", null, 500);
  }
}

// POST /api/v1/user/tokens — Generate a new personal access token
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to generate a personal access token", null, 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = createTokenSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input", String(first?.path?.[0] ?? ""), 400);
  }

  const { name, scopes, expirationDays } = parsed.data;

  try {
    const result = await generatePersonalAccessToken({
      userId,
      name,
      scopes,
      expirationDays,
    });

    return apiOk({
      token: result.token,
      record: result.record,
    }, 201);
  } catch (err: any) {
    console.error("[Tokens API] Error generating token:", err);
    return apiError("INTERNAL_ERROR", "Failed to generate token", null, 500);
  }
}
