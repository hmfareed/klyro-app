import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/notifications — get notifications for current user
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return apiOk({ notifications, unreadCount });
}

const patchSchema = z.object({
  notificationId: z.string().optional(), // if omitted, marks all as read
});

// PATCH /api/v1/notifications — mark read
export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid input.", null, 400);
  }

  if (parsed.data.notificationId) {
    await prisma.notification.updateMany({
      where: { id: parsed.data.notificationId, userId },
      data: { isRead: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  return apiOk({ success: true });
}
