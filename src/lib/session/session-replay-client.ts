"use client";

import type { Id } from "../../../convex/_generated/dataModel";
import { clientFetch } from "@/lib/fingerprint/client-identity";
import type { UnverifiedFingerprintHints } from "@/lib/fingerprint/fingerprint-shared";
import type { SessionReplayEventType } from "./session-replay-contract";

type SessionReplayClientEvent = {
  sessionId: Id<"sessions">;
  level: 1 | 2 | 3;
  eventType: SessionReplayEventType;
  screen: string;
  route?: string;
  clientAt?: number;
  summary?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  fingerprintSummary?: UnverifiedFingerprintHints;
};

export async function postSessionReplayEvent(input: SessionReplayClientEvent): Promise<void> {
  await clientFetch("/api/session/replay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: input.sessionId,
      level: input.level,
      eventType: input.eventType,
      screen: input.screen,
      route: input.route ?? (typeof window === "undefined" ? "/" : window.location.pathname),
      clientAt: input.clientAt ?? Date.now(),
      summary: {
        ...(input.summary ?? {}),
        ...(input.fingerprintSummary ? { fingerprint: input.fingerprintSummary } : {}),
      },
      snapshot: input.snapshot,
    }),
  });
}
