import { prisma } from "@/shared/db/prisma";
import { createHmac } from "node:crypto";

export interface DispatchWebhookParams {
  repositoryId: string;
  event: string;
  payload: Record<string, unknown>;
}

/**
 * Dispatches webhooks asynchronously in background and logs delivery outcomes
 */
export async function dispatchRepositoryWebhooks(params: DispatchWebhookParams): Promise<void> {
  try {
    const repo = await prisma.repository.findUnique({
      where: { id: params.repositoryId },
      select: { archived: true, status: true },
    });

    // Suspend deliveries for archived, deletion pending, or inactive repositories
    if (!repo || repo.archived || repo.status !== "ACTIVE") {
      return;
    }

    const webhooks = await prisma.repositoryWebhook.findMany({
      where: {
        repositoryId: params.repositoryId,
        active: true,
      },
    });

    for (const webhook of webhooks) {
      if (webhook.events.length > 0 && !webhook.events.includes(params.event) && !webhook.events.includes("*")) {
        continue;
      }

      // Deliver in background without blocking caller
      deliverSingleWebhook(webhook, params.event, params.payload).catch((err) => {
        console.error(`[WebhookDelivery] Error delivering to ${webhook.url}:`, err);
      });
    }
  } catch (err) {
    console.error("[WebhookDispatch] Failed to dispatch webhooks:", err);
  }
}

async function deliverSingleWebhook(webhook: any, event: string, payload: Record<string, unknown>) {
  const startTime = Date.now();
  const bodyString = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    repositoryId: webhook.repositoryId,
    data: payload,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Klyro-Webhook-Hookshot/1.0",
    "X-Klyro-Event": event,
    "X-Klyro-Delivery": `${webhook.id}-${Date.now()}`,
  };

  if (webhook.secret) {
    const signature = createHmac("sha256", webhook.secret).update(bodyString).digest("hex");
    headers["X-Klyro-Signature-256"] = `sha256=${signature}`;
  }

  let statusCode: number | null = null;
  let responseText: string | null = null;
  let errorMsg: string | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: bodyString,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    statusCode = res.status;
    responseText = (await res.text().catch(() => "")).slice(0, 2000);
  } catch (err: any) {
    errorMsg = err.name === "AbortError" ? "Delivery timed out (10s)" : err.message || "Failed to reach endpoint";
  }

  const durationMs = Date.now() - startTime;

  await prisma.repositoryWebhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event,
      payload: (payload as object) || {},
      statusCode,
      responseBody: responseText,
      durationMs,
      error: errorMsg,
    },
  });
}
