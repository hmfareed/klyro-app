import Redis from "ioredis";

// Shared Redis per 01: BullMQ backing, sliding-window rate limits (12),
// realtime presence fan-out (08/11). Lazy singleton so web/worker share config.
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Don't crash / spam unhandled 'error' events when Redis is down (dev with no services).
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  redis.on("error", () => {
    // Swallowed: callers (rate-limit, queue) fail-open with warnings.
  });
  return redis;
}
