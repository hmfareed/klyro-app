import { getRedis } from "@/shared/db/redis";

// 12-security sliding-window limits. 14-api-design: 429 + Retry-After,
// X-RateLimit-* headers set by callers. Auth endpoints are strictest.
// Fail-open: if Redis is down/slow (local dev with no services, network
// blip), allow the request rather than hanging the signup/login flow.
// Rate limiting must never be a hard dependency.
export async function slidingWindow(key: string, limit: number, windowSec: number) {
  try {
    const redis = getRedis();
    const now = Date.now();
    const windowStart = now - windowSec * 1000;
    const member = `${now}-${Math.random().toString(36).slice(2)}`;
    const pipe = redis.pipeline();
    pipe.zremrangebyscore(key, 0, windowStart);
    pipe.zadd(key, now, member);
    pipe.zcard(key);
    pipe.expire(key, windowSec);
    const results = (await Promise.race([
      pipe.exec(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("redis-timeout")), 1500),
      ),
    ])) as unknown as Array<[Error | null, unknown]> | null;
    const count = (results?.[2]?.[1] as number) ?? 0;
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), count };
  } catch (err) {
    console.warn("[klyro] rate-limit unavailable, fail-open:", (err as Error).message);
    return { allowed: true, remaining: limit, count: 0 };
  }
}
