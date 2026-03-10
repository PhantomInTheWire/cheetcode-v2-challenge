export type AbuseRoute =
  | "session"
  | "session-replay"
  | "validate-l1"
  | "validate-l2"
  | "validate-l3"
  | "finish-l1"
  | "finish-l2"
  | "finish-l3";

type RouteConfig = {
  windowMs: number;
  maxHits: number;
  shadowWindowMs: number;
  shadowThreshold: number;
};

const routeConfigs: Record<AbuseRoute, RouteConfig> = {
  session: { windowMs: 60_000, maxHits: 8, shadowWindowMs: 10 * 60_000, shadowThreshold: 40 },
  "session-replay": {
    windowMs: 60_000,
    maxHits: 90,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 500,
  },
  "validate-l1": {
    windowMs: 60_000,
    maxHits: 150,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 900,
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
  "/api/session/replay": "session-replay",
  "/api/validate-l1": "validate-l1",
  "/api/validate-l2": "validate-l2",
  "/api/validate-l3": "validate-l3",
  "/api/finish-l1": "finish-l1",
  "/api/finish-l2": "finish-l2",
  "/api/finish-l3": "finish-l3",
};
