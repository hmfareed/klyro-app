import { getRedis } from "@/shared/db/redis";

// 12-security sliding-window limits. 14-api-design: 429 + Retry-After,
// X-RateLimit-* headers set by callers. Auth endpoints are strictest.
export async function slidingWindow(key: string, limit: number, windowSec: number) {
  const redis = getRedis();
  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const member = `${now}-${Math.random().toString(36).slice(2)}`;
  const pipe = redis.pipeline();
  pipe.zremrangebyscore(key, 0, windowStart);
  pipe.zadd(key, now, member);
  pipe.zcard(key);
  pipe.expire(key, windowSec);
  const results = await pipe.exec();
  const count = (results?.[2]?.[1] as number) ?? 0;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), count };
}
