import "dotenv/config";
import express from "express";
import { Worker } from "bullmq";
import { getRedis } from "../src/shared/db/redis";

// Standalone worker per 01-architecture: long-running / webhook-heavy work lives
// here, not in Next Route Handlers. Phase 0: email delivery (verify). Later:
// GitHub webhooks (Phase 3), notification fan-out (Phase 2), AI jobs (Phase 5),
// record generation (Phase 3). Bull Board for queue health (13).
const app = express();
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true, service: "klyro-worker" }));

const connection = getRedis();

new Worker(
  "email",
  async (job) => {
    if (job.name === "verify-email") {
      const { to, verifyUrl } = job.data as { to: string; verifyUrl: string };
      // Phase 0: log; Phase 2 swaps in Resend/SES (Mailhog catches SMTP locally).
      console.log(`[worker:email] to=${to} verify=${verifyUrl}`);
    }
  },
  { connection },
);

const port = Number(process.env.WORKER_PORT ?? 4000);
app.listen(port, () => console.log(`[worker] listening on :${port}`));
