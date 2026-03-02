export type AbuseRoute =
  | "session"
  | "validate"
  | "validate-batch"
  | "validate-l2"
  | "validate-l3"
  | "finish"
  | "finish-l2"
  | "finish-l3";

type RouteConfig = {
  windowMs: number;
  maxHits: number;
  shadowWindowMs: number;
  shadowThreshold: number;
};

type AbuseDecision = {
  limited: boolean;
  retryAfterSeconds: number;
  shadowBanned: boolean;
};

export const SHADOW_BAN_HEADER = "x-ctf-shadow-banned";

const DEFAULT_IDENTITY = "anon";
const SHADOW_BAN_DURATION_MS = 24 * 60 * 60 * 1000;

const routeConfigs: Record<AbuseRoute, RouteConfig> = {
  session: { windowMs: 60_000, maxHits: 8, shadowWindowMs: 10 * 60_000, shadowThreshold: 40 },
  validate: { windowMs: 60_000, maxHits: 150, shadowWindowMs: 10 * 60_000, shadowThreshold: 900 },
  "validate-batch": { windowMs: 60_000, maxHits: 80, shadowWindowMs: 10 * 60_000, shadowThreshold: 450 },
  "validate-l2": { windowMs: 60_000, maxHits: 120, shadowWindowMs: 10 * 60_000, shadowThreshold: 700 },
  "validate-l3": { windowMs: 60_000, maxHits: 60, shadowWindowMs: 10 * 60_000, shadowThreshold: 300 },
  finish: { windowMs: 60_000, maxHits: 20, shadowWindowMs: 10 * 60_000, shadowThreshold: 80 },
  "finish-l2": { windowMs: 60_000, maxHits: 20, shadowWindowMs: 10 * 60_000, shadowThreshold: 80 },
  "finish-l3": { windowMs: 60_000, maxHits: 20, shadowWindowMs: 10 * 60_000, shadowThreshold: 80 },
};

export const API_ROUTE_TO_ABUSE_ROUTE: Record<string, AbuseRoute> = {
  "/api/session": "session",
  "/api/validate": "validate",
  "/api/validate-batch": "validate-batch",
  "/api/validate-l2": "validate-l2",
  "/api/validate-l3": "validate-l3",
  "/api/finish": "finish",
  "/api/finish-l2": "finish-l2",
  "/api/finish-l3": "finish-l3",
};

const eventsByKey = new Map<string, number[]>();
const shadowBans = new Map<string, number>();

function hashIdentity(raw: string): string {
  // Edge-safe non-cryptographic hash (FNV-1a variant) for key anonymization.
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
  const fingerprint = request.headers.get("x-client-fingerprint")?.trim() || DEFAULT_IDENTITY;

  const keys = new Set<string>();
  keys.add(`ip:${hashIdentity(ip)}`);
  if (fingerprint && fingerprint !== DEFAULT_IDENTITY) {
    keys.add(`fp:${hashIdentity(fingerprint)}`);
  }
  return [...keys];
}

function prune(events: number[], cutoff: number): number[] {
  let firstValid = 0;
  while (firstValid < events.length && events[firstValid] < cutoff) firstValid++;
  return firstValid === 0 ? events : events.slice(firstValid);
}

export function checkAndTrackAbuse(request: Request, route: AbuseRoute): AbuseDecision {
  if (process.env.NODE_ENV === "test") {
    return { limited: false, retryAfterSeconds: 0, shadowBanned: false };
  }

  const config = routeConfigs[route];
  const now = Date.now();
  const keys = getIdentityKeys(request);

  let shadowBanned = false;
  for (const key of keys) {
    const expiresAt = shadowBans.get(key) ?? 0;
    if (expiresAt > now) {
      shadowBanned = true;
    } else if (expiresAt > 0) {
      shadowBans.delete(key);
    }
  }

  let limited = false;
  let maxObservedHits = 0;

  for (const key of keys) {
    const existing = eventsByKey.get(key) ?? [];
    const longWindowEvents = prune(existing, now - config.shadowWindowMs);
    longWindowEvents.push(now);
    eventsByKey.set(key, longWindowEvents);

    const shortWindowEvents = prune(longWindowEvents, now - config.windowMs);
    maxObservedHits = Math.max(maxObservedHits, shortWindowEvents.length);

    if (shortWindowEvents.length > config.maxHits) {
      limited = true;
    }
    if (longWindowEvents.length > config.shadowThreshold) {
      shadowBans.set(key, now + SHADOW_BAN_DURATION_MS);
      shadowBanned = true;
    }
  }

  const overflow = Math.max(0, maxObservedHits - config.maxHits);
  const retryAfterSeconds = Math.min(60, Math.max(1, overflow));

  return {
    limited,
    retryAfterSeconds,
    shadowBanned,
  };
}
