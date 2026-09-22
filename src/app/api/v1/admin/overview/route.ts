import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";

// GET /api/v1/admin/overview — 22 §2 queue counts. Gated by PlatformAdmin;
// pre-migration (table missing) returns empty queues so the console renders.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return apiError("UNAUTHENTICATED", "Sign in required.", null, 401);
  try {
    const db = prisma as unknown as {
      platformAdmin: { findUnique: (a: unknown) => Promise<{ role: string } | null> };
      analyticsEvent: { count: (a?: unknown) => Promise<number>; findMany: (a: unknown) => Promise<{ id: string; event: string; createdAt: Date }[]> };
    };
    const admin = await db.platformAdmin.findUnique({ where: { userId } });
    if (!admin) return apiError("FORBIDDEN", "Admin access required.", null, 403);
    const [reports, disputes, events] = await Promise.all([
      db.analyticsEvent.count({ where: { event: "member_left_early" } }).catch(() => 0),
      db.analyticsEvent.count({ where: { event: "contribution_record_issued" } }).catch(() => 0),
      db.analyticsEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);
    return apiOk({ role: admin.role, queues: { reports, disputes }, recentEvents: events });
  } catch {
    return apiOk({ role: null, queues: { reports: 0, disputes: 0 }, recentEvents: [], _note: "admin tables pending migration" });
  }
}
