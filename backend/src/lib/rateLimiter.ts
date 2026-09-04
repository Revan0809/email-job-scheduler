import { redis } from "./redis";
import { env } from "../config/env";

const HOUR_MS = 60 * 60 * 1000;

// Atomically increments the per-sender hourly counter and only "consumes" a
// slot if it stays within the limit. Safe across multiple worker processes
// because the whole check-and-increment happens as a single Lua script
// executed atomically by Redis.
const CONSUME_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttlSeconds = tonumber(ARGV[2])
local current = redis.call('INCR', key)
if current == 1 then
  redis.call('EXPIRE', key, ttlSeconds)
end
if current > limit then
  redis.call('DECR', key)
  return 0
else
  return 1
end
`;

export function hourBucketFor(timestampMs: number): number {
  return Math.floor(timestampMs / HOUR_MS);
}

function rateKey(sender: string, hourBucket: number): string {
  return `rate:${sender}:${hourBucket}`;
}

export interface HourlyLimitResult {
  allowed: boolean;
  hourBucket: number;
  nextWindowStartMs: number;
}

export async function tryConsumeHourlySlot(
  sender: string,
  limit: number = env.maxEmailsPerHourPerSender,
  now: number = Date.now()
): Promise<HourlyLimitResult> {
  const hourBucket = hourBucketFor(now);
  const key = rateKey(sender, hourBucket);
  const result = (await redis.eval(CONSUME_SCRIPT, 1, key, limit, 3600)) as number;
  return {
    allowed: result === 1,
    hourBucket,
    nextWindowStartMs: (hourBucket + 1) * HOUR_MS,
  };
}

// Enforces a minimum spacing between two sends for the same sender.
// Uses SET ... NX PX as an atomic "reserve this slot" primitive so
// concurrent workers can't both claim the same window.
export async function tryReserveSenderSlot(
  sender: string,
  minDelayMs: number = env.senderMinDelayMs
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  if (minDelayMs <= 0) return { allowed: true, retryAfterMs: 0 };

  const key = `lastsend:${sender}`;
  const now = Date.now();
  const set = await redis.set(key, String(now), "PX", minDelayMs, "NX");
  if (set === "OK") {
    return { allowed: true, retryAfterMs: 0 };
  }

  const lastSendRaw = await redis.get(key);
  const lastSend = lastSendRaw ? parseInt(lastSendRaw, 10) : now;
  const retryAfterMs = Math.max(0, lastSend + minDelayMs - now);
  return { allowed: false, retryAfterMs };
}
