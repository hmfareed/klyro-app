import { prisma } from "@/shared/db/prisma";

export type NotificationType =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_DECIDED"
  | "TASK_ASSIGNED"
  | "DISCUSSION_REPLY"
  | "RECORD_ISSUED";

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  linkUrl?: string;
}) {
  try {
    return await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        linkUrl: params.linkUrl,
      },
    });
  } catch (err) {
    console.error("[Notification] Failed to create notification:", err);
    return null;
  }
}
