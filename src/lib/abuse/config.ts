export type AbuseRoute =
  | "session"
  | "session-replay"
  | "level-1-validate"
  | "level-2-validate"
  | "level-3-validate"
  | "level-1-finish"
  | "level-2-finish"
  | "level-3-finish";

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
  "level-1-validate": {
    windowMs: 60_000,
    maxHits: 150,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 900,
  },
  "level-2-validate": {
    windowMs: 60_000,
    maxHits: 120,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 700,
  },
  "level-3-validate": {
    windowMs: 60_000,
    maxHits: 60,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 300,
  },
  "level-1-finish": {
    windowMs: 60_000,
    maxHits: 20,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 80,
  },
  "level-2-finish": {
    windowMs: 60_000,
    maxHits: 20,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 80,
  },
  "level-3-finish": {
    windowMs: 60_000,
    maxHits: 20,
    shadowWindowMs: 10 * 60_000,
    shadowThreshold: 80,
  },
};

export function getRouteConfig(route: AbuseRoute): RouteConfig {
  return routeConfigs[route];
}

export const API_ROUTE_TO_ABUSE_ROUTE: Record<string, AbuseRoute> = {
  "/api/session": "session",
  "/api/session/replay": "session-replay",
  "/api/level-1/validate": "level-1-validate",
  "/api/level-2/validate": "level-2-validate",
  "/api/level-3/validate": "level-3-validate",
  "/api/level-1/finish": "level-1-finish",
  "/api/level-2/finish": "level-2-finish",
  "/api/level-3/finish": "level-3-finish",
};
