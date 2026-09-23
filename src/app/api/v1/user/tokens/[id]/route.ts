import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/v1/user/tokens/[id] — Revoke a personal access token
export async function DELETE(_req: Request, { params }: RouteParams) {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to revoke a token", null, 401);
  }

  const { id } = await params;

  try {
    const token = await prisma.personalAccessToken.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!token || token.userId !== userId) {
      return apiError("NOT_FOUND", "Personal access token not found", null, 404);
    }

    await prisma.personalAccessToken.delete({
      where: { id },
    });

    return apiOk({ revoked: true });
  } catch (err: any) {
    console.error("[Tokens API] Error revoking token:", err);
    return apiError("INTERNAL_ERROR", "Failed to revoke token", null, 500);
  }
}
