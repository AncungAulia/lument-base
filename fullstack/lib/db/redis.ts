import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Upstash auto-deserializes values that look like JSON. If you later pass the
// result to JSON.parse you get "Unexpected non-whitespace character" because
// an already-parsed array coerces to "a,b" which JSON rejects. Use this
// helper instead of calling JSON.parse directly on redis.get() results.
export function parseRedisJson<T>(val: unknown): T | null {
  if (val == null) return null;
  if (typeof val === "string") {
    try { return JSON.parse(val) as T; } catch { return null; }
  }
  return val as T;
}
