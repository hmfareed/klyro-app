import Redis from "ioredis";

// Shared Redis per 01: BullMQ backing, sliding-window rate limits (12),
// realtime presence fan-out (08/11). Lazy singleton so web/worker share config.
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;
  redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  return redis;
}
