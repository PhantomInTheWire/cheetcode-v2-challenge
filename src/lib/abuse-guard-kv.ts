import { Redis } from "@upstash/redis";
import {
  type AbuseDecision,
  type AbuseRoute,
  TRUSTED_FINGERPRINT_HEADER,
  getRouteConfig,
} from "./abuse-guard";

const DEFAULT_IDENTITY = "anon";
const SHADOW_BAN_DURATION_SECONDS = 24 * 60 * 60;
const KEY_PREFIX = "ctf:abuse:v1";
let redisClient: Redis | null | undefined;

function hashIdentity(raw: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ 0x9e3779b9;
    h2 = Math.imul(h2, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${a}${b}`;
}

function extractIpAddress(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return DEFAULT_IDENTITY;
}

function getIdentityKeys(request: Request): string[] {
  const ip = extractIpAddress(request);
  const fingerprint = request.headers.get(TRUSTED_FINGERPRINT_HEADER)?.trim() || DEFAULT_IDENTITY;
  const keys = new Set<string>();
  keys.add(`ip:${hashIdentity(ip)}`);
  if (fingerprint !== DEFAULT_IDENTITY) {
    keys.add(`fp:${hashIdentity(fingerprint)}`);
  }
  return [...keys];
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
