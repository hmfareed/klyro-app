import { z } from "zod";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import {
  addSshKeyForUser,
  listSshKeysForUser,
} from "@/server/auth/ssh-key-service";

const addKeySchema = z.object({
  title: z.string().max(80, "Title must be at most 80 characters").optional(),
  publicKey: z.string().min(10, "Public key is required"),
});

// GET /api/v1/user/ssh-keys — List all SSH keys for the authenticated user
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to view SSH keys", null, 401);
  }

  try {
    const keys = await listSshKeysForUser(userId);
    return apiOk({ keys });
  } catch (err: any) {
    console.error("[SSH Keys API] Error listing keys:", err);
    return apiError("INTERNAL_ERROR", "Failed to retrieve SSH keys", null, 500);
  }
}

// POST /api/v1/user/ssh-keys — Add a new SSH public key
export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return apiError("UNAUTHENTICATED", "Sign in required to add an SSH key", null, 401);
  }

  const body = await req.json().catch(() => null);
  const parsed = addKeySchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError("VALIDATION_ERROR", first?.message ?? "Invalid input", String(first?.path?.[0] ?? ""), 400);
  }

  const { title, publicKey } = parsed.data;

  try {
    const record = await addSshKeyForUser({
      userId,
      title,
      publicKey,
    });

    return apiOk({
      key: {
        id: record.id,
        title: record.title,
        fingerprint: record.fingerprint,
        keyType: record.keyType,
        createdAt: record.createdAt,
        lastUsedAt: record.lastUsedAt,
      },
    }, 201);
  } catch (err: any) {
    console.error("[SSH Keys API] Error adding key:", err);
    const message = err.message || "Failed to add SSH key";
    const status = message.includes("Invalid") || message.includes("already registered") ? 400 : 500;
    return apiError("SSH_KEY_ERROR", message, null, status);
  }
}
