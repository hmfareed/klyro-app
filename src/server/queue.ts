import { Queue } from "bullmq";
import { getRedis } from "@/shared/db/redis";

// 01-architecture + 11-notifications: domain event -> BullMQ queue -> worker.
// No inline sends in request handlers (channel-extensible). Queues grow by phase:
// email (Phase 0 verify), notifications (Phase 2), webhooks/ai/record-gen (Phase 3/5).
let emailQueue: Queue | null = null;

export function getEmailQueue(): Queue {
  if (emailQueue) return emailQueue;
  emailQueue = new Queue("email", { connection: getRedis() });
  return emailQueue;
}

export async function enqueueVerificationEmail(to: string, verifyUrl: string) {
  // Worker delivers via Mailhog locally / Resend/SES in staging+prod.
  // Dev fallback: also log URL so signup works with no worker running.
  if (process.env.NODE_ENV !== "production") console.log(`[klyro] verify ${to}: ${verifyUrl}`);
  try {
    await getEmailQueue().add("verify-email", { to, verifyUrl }, { attempts: 5, backoff: { type: "exponential", delay: 10_000 } });
  } catch (err) {
    console.warn("[klyro] queue unavailable, verify via console log above:", (err as Error).message);
  }
}
