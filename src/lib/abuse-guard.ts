import { getIdentityKeys, TRUSTED_FINGERPRINT_HEADER } from "./abuse-identity";

export type AbuseRoute =
  | "session"
  | "validate-l1"
  | "validate-batch"
  | "validate-l2"
  | "validate-l3"
  | "finish-l1"
  | "finish-l2"
  | "finish-l3";

export type RouteConfig = {
  windowMs: number;
  maxHits: number;
  shadowWindowMs: number;
  shadowThreshold: number;
};

export type AbuseDecision = {
  limited: boolean;
  retryAfterSeconds: number;
  shadowBanned: boolean;
};

export const SHADOW_BAN_HEADER = "x-ctf-shadow-banned";
export { TRUSTED_FINGERPRINT_HEADER };
const SHADOW_BAN_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_KEYS = 20_000;
const SWEEP_INTERVAL_MS = 60_000;

const routeConfigs: Record<AbuseRoute, RouteConfig> = {
  session: { windowMs: 60_000, maxHits: 8, shadowWindowMs: 10 * 60_000, shadowThreshold: 40 },
  "validate-l1": {
    windowMs: 60_000,
    maxHits: 150,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 900,
  },
  "validate-batch": {
    windowMs: 60_000,
    maxHits: 80,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 450,
  },
  "validate-l2": {
    windowMs: 60_000,
    maxHits: 120,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 700,
  },
  "validate-l3": {
    windowMs: 60_000,
    maxHits: 60,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 300,
  },
  "finish-l1": { windowMs: 60_000, maxHits: 20, shadowWindowMs: 10 * 60_000, shadowThreshold: 80 },
  "finish-l2": { windowMs: 60_000, maxHits: 20, shadowWindowMs: 10 * 60_000, shadowThreshold: 80 },
  "finish-l3": { windowMs: 60_000, maxHits: 20, shadowWindowMs: 10 * 60_000, shadowThreshold: 80 },
};

export function getRouteConfig(route: AbuseRoute): RouteConfig {
  return routeConfigs[route];
}

export const API_ROUTE_TO_ABUSE_ROUTE: Record<string, AbuseRoute> = {
  "/api/session": "session",
  "/api/validate-l1": "validate-l1",
  "/api/validate-batch": "validate-batch",
  "/api/validate-l2": "validate-l2",
  "/api/validate-l3": "validate-l3",
  "/api/finish-l1": "finish-l1",
  "/api/finish-l2": "finish-l2",
  "/api/finish-l3": "finish-l3",
};

const eventsByKey = new Map<string, number[]>();
const shadowBans = new Map<string, number>();
let lastSweepAt = 0;

function sweepExpired(now: number): void {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  for (const [key, events] of eventsByKey) {
    const pruned = prune(events, now - 10 * 60_000);
    if (pruned.length === 0) {
      eventsByKey.delete(key);
    } else if (pruned !== events) {
      eventsByKey.set(key, pruned);
    }
  }

  for (const [key, expiresAt] of shadowBans) {
    if (expiresAt <= now) shadowBans.delete(key);
  }

  if (eventsByKey.size > MAX_KEYS) {
    const overflow = eventsByKey.size - MAX_KEYS;
    let removed = 0;
    for (const key of eventsByKey.keys()) {
      eventsByKey.delete(key);
      removed++;
      if (removed >= overflow) break;
    }
  }
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
  sweepExpired(now);
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
  const retryAfterSeconds = limited ? Math.min(60, Math.max(1, overflow)) : 0;

  return {
    limited,
    retryAfterSeconds,
    shadowBanned,
  };
}
