import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { deleteSshKeyForUser } from "@/server/auth/ssh-key-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// DELETE /api/v1/user/ssh-keys/[id] — Delete an SSH key
export async function DELETE(_req: Request, { params }: RouteParams) {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to delete an SSH key", null, 401);
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Key ID is required", "id", 400);
  }

  try {
    await deleteSshKeyForUser(userId, id);
    return apiOk({ deleted: true });
  } catch (err: any) {
    console.error("[SSH Keys API] Error deleting key:", err);
    return apiError("SSH_KEY_ERROR", err.message || "Failed to delete SSH key", null, 404);
  }
}
