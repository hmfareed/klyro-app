import { z } from "zod";
import { prisma } from "@/shared/db/prisma";
import { getSessionUserId } from "@/shared/auth/session";
import { apiError, apiOk } from "@/shared/api/errors";
import { ANALYTICS_EVENTS } from "@/shared/analytics/events";

// POST /api/v1/analytics — 24 §3 + 30 §8 activation funnel ingest.
// Server-persisted so numbers can't be skewed by ad-blockers/bugged clients.
const bodySchema = z.object({
  event: z.enum(ANALYTICS_EVENTS),
  projectId: z.string().max(64).optional(),
  props: z.record(z.string(), z.string()).optional(),
});

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Unknown event.", null, 400);
  try {
    await (prisma as unknown as { analyticsEvent: { create: (a: unknown) => Promise<unknown> } }).analyticsEvent.create({
      data: { event: parsed.data.event, userId, projectId: parsed.data.projectId, props: parsed.data.props ?? {} },
    });
  } catch (err) {
    // Table may not exist until `prisma db push` after the 21–30 schema
    // additions — log and still 200 so onboarding never blocks on analytics.
    console.log("[analytics]", parsed.data.event, { userId, ...parsed.data.props });
  }
  return apiOk({ ok: true });
}
