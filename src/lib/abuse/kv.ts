import { Redis } from "@upstash/redis";
import { type AbuseDecision, type AbuseRoute, getRouteConfig } from "./guard";
import { getIdentityKeys } from "./identity";

const SHADOW_BAN_DURATION_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = "ctf:abuse:v1";
let redisClient: Redis | null | undefined;

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    redisClient = null;
    return redisClient;
  }
  redisClient = Redis.fromEnv();
  return redisClient;
}

async function incrementWindowCounter(key: string, windowSeconds: number): Promise<number | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const pipeline = redis.pipeline();
  pipeline.incr(key);
  pipeline.expire(key, windowSeconds);
  const result = await pipeline.exec();
  const first = result?.[0];
  return typeof first === "number" ? first : null;
}

async function markShadowBan(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(key, "1", { ex: SHADOW_BAN_DURATION_SECONDS });
}

export async function checkAndTrackAbuseInKv(
  request: Request,
  route: AbuseRoute,
): Promise<AbuseDecision | null> {
  if (process.env.NODE_ENV === "test") {
    return { limited: false, retryAfterSeconds: 0, shadowBanned: false };
  }
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const cfg = getRouteConfig(route);
  const keys = getIdentityKeys(request);
  let limited = false;
  let maxObservedHits = 0;
  let shadowBanned = false;

  const shortWindowSeconds = Math.max(1, Math.ceil(cfg.windowMs / 1000));
  const shadowWindowSeconds = Math.max(1, Math.ceil(cfg.shadowWindowMs / 1000));

  for (const identity of keys) {
    const shortKey = `${KEY_PREFIX}:short:${route}:${identity}`;
    const longKey = `${KEY_PREFIX}:long:${route}:${identity}`;
    const banKey = `${KEY_PREFIX}:ban:${identity}`;

    const [shortHits, longHits, banFlag] = await Promise.all([
      incrementWindowCounter(shortKey, shortWindowSeconds),
      incrementWindowCounter(longKey, shadowWindowSeconds),
      redis.get(banKey),
    ]);

    const observedShort = shortHits ?? 0;
    const observedLong = longHits ?? 0;
    maxObservedHits = Math.max(maxObservedHits, observedShort);
    if (observedShort > cfg.maxHits) limited = true;

    if (banFlag === "1" || banFlag === 1) {
      shadowBanned = true;
    }
    if (observedLong > cfg.shadowThreshold) {
      shadowBanned = true;
      await markShadowBan(banKey);
    }
  }

  const overflow = Math.max(0, maxObservedHits - cfg.maxHits);
  return {
    limited,
    retryAfterSeconds: limited ? Math.min(60, Math.max(1, overflow)) : 0,
    shadowBanned,
  };
}
