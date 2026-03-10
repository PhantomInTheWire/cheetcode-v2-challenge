import { Redis } from "@upstash/redis";
import { type AbuseRoute, getRouteConfig } from "./config";
import { getIdentityKeys } from "./identity";

const SHADOW_BAN_DURATION_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = "ctf:abuse:v1";
const LEVEL3_INFLIGHT_PREFIX = `${KEY_PREFIX}:level3-inflight`;
const TEST_LEVEL3_LOCKS = new Map<string, string>();
let redisClient: Redis | null | undefined;

export type AbuseDecision = {
  limited: boolean;
  retryAfterSeconds: number;
  shadowBanned: boolean;
};

function getShadowBanStorageKey(identityKey: string): string {
  return `${KEY_PREFIX}:ban:${identityKey}`;
}

function getLevel3InflightKey(github: string): string {
  return `${LEVEL3_INFLIGHT_PREFIX}:${github.trim().toLowerCase()}`;
}

function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    redisClient = null;
    return redisClient;
  }
  redisClient = Redis.fromEnv();
  return redisClient;
}

export function getKvClient(): Redis | null {
  return getRedisClient();
}

export function isKvConfigured(): boolean {
  return getRedisClient() !== null;
}

export async function getKvJson<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const value = await redis.get<T>(key);
  return value ?? null;
}

export async function setKvJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(key, value, { ex: ttlSeconds });
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

export async function getKvShadowBanStates(
  identityKeys: string[],
): Promise<Record<string, boolean>> {
  const redis = getRedisClient();
  const uniqueKeys = [...new Set(identityKeys)];
  if (!redis || uniqueKeys.length === 0) return {};

  const pipeline = redis.pipeline();
  for (const identityKey of uniqueKeys) {
    pipeline.get(getShadowBanStorageKey(identityKey));
  }
  const results = await pipeline.exec();

  return Object.fromEntries(
    uniqueKeys.map((identityKey, index) => {
      const value = results?.[index];
      return [identityKey, value === "1" || value === 1];
    }),
  );
}

export async function setKvShadowBan(
  identityKey: string,
  ttlSeconds: number = SHADOW_BAN_DURATION_SECONDS,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(getShadowBanStorageKey(identityKey), "1", { ex: Math.max(1, ttlSeconds) });
}

export async function clearKvShadowBan(identityKey: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(getShadowBanStorageKey(identityKey));
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
    const banKey = getShadowBanStorageKey(identity);

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

export async function acquireKvLevel3InflightLock(
  github: string,
  ttlMs: number,
): Promise<{ ok: true; token: string } | { ok: false; reason: "busy" | "unavailable" }> {
  if (process.env.NODE_ENV === "test") {
    const key = getLevel3InflightKey(github);
    if (TEST_LEVEL3_LOCKS.has(key)) {
      return { ok: false, reason: "busy" };
    }
    const token = crypto.randomUUID();
    TEST_LEVEL3_LOCKS.set(key, token);
    return { ok: true, token };
  }

  const redis = getRedisClient();
  if (!redis) {
    return { ok: false, reason: "unavailable" };
  }

  const token = crypto.randomUUID();
  const result = await redis.set(getLevel3InflightKey(github), token, {
    nx: true,
    px: Math.max(1, Math.floor(ttlMs)),
  });

  if (result !== "OK") {
    return { ok: false, reason: "busy" };
  }

  return { ok: true, token };
}

export async function releaseKvLevel3InflightLock(github: string, token: string): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    const key = getLevel3InflightKey(github);
    if (TEST_LEVEL3_LOCKS.get(key) === token) {
      TEST_LEVEL3_LOCKS.delete(key);
    }
    return;
  }

  const redis = getRedisClient();
  if (!redis) return;

  const key = getLevel3InflightKey(github);
  const active = await redis.get<string>(key);
  if (active === token) {
    await redis.del(key);
  }
}

export function resetKvLevel3InflightLocksForTests(): void {
  TEST_LEVEL3_LOCKS.clear();
}
