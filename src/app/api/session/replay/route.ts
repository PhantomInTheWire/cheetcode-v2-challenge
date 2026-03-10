import { NextResponse } from "next/server";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { getJsonBodyWithLimit } from "../../../../lib/api-route";
import { ENV } from "../../../../lib/env-vars";
import {
  SESSION_REPLAY_EVENT_TYPES,
  type SessionReplayEventType,
} from "../../../../lib/session/session-replay-contract";
import { FINISH_ROUTE_EXPIRY_GRACE_MS, withOwnedSessionRoute } from "../../../../lib/route-handler";
import { recordSessionReplayEvent } from "../../../../lib/session/session-replay";
import { recordSessionIdentity } from "../../../../lib/session/session-identity";
import { recordSessionFingerprint } from "../../../../lib/session/session-fingerprint";
import { parseUnverifiedFingerprintHints } from "../../../../lib/fingerprint/fingerprint-shared";

type ReplayBody = {
  sessionId?: string;
  level?: number;
  eventType?: string;
  screen?: string;
  route?: string;
  clientAt?: number;
  summary?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
};

type ReplayRequestBody = Omit<ReplayBody, "sessionId" | "eventType" | "screen"> & {
  sessionId: string;
  eventType: SessionReplayEventType;
  screen: string;
};

const MAX_REPLAY_BODY_BYTES = 256_000;

function isReplayEventType(value: string | undefined): value is SessionReplayEventType {
  return (
    typeof value === "string" &&
    SESSION_REPLAY_EVENT_TYPES.includes(value as SessionReplayEventType)
  );
}

export async function POST(request: Request) {
  return withOwnedSessionRoute<ReplayRequestBody>(
    request,
    {
      expiryGraceMs: FINISH_ROUTE_EXPIRY_GRACE_MS,
      parseBody: async (incomingRequest) =>
        await getJsonBodyWithLimit<unknown>(incomingRequest, MAX_REPLAY_BODY_BYTES),
      validateBody: (body): body is ReplayRequestBody =>
        !!body &&
        typeof body === "object" &&
        typeof (body as ReplayBody).sessionId === "string" &&
        typeof (body as ReplayBody).screen === "string" &&
        isReplayEventType((body as ReplayBody).eventType),
      invalidBodyResponse: NextResponse.json(
        { error: "sessionId, screen, and valid eventType are required" },
        { status: 400 },
      ),
      bodyTooLargeResponse: NextResponse.json(
        { error: "replay payload too large" },
        { status: 413 },
      ),
      errorLabel: "/api/session/replay error",
      errorResponse: NextResponse.json({ error: "Failed to record replay" }, { status: 500 }),
    },
    async ({ github, convex, session, body }) => {
      const level = session.level ?? 1;
      if (level !== 1 && level !== 2 && level !== 3) {
        return NextResponse.json({ error: "invalid level" }, { status: 400 });
      }

      const fingerprintHints =
        body.summary &&
        typeof body.summary === "object" &&
        "fingerprint" in body.summary &&
        body.summary.fingerprint &&
        typeof body.summary.fingerprint === "object"
          ? parseUnverifiedFingerprintHints(body.summary.fingerprint)
          : undefined;
      const sanitizedSummary =
        fingerprintHints && body.summary && typeof body.summary === "object"
          ? { ...body.summary, fingerprint: fingerprintHints }
          : (body.summary ?? {});

      await recordSessionReplayEvent({
        convex,
        secret: ENV.CONVEX_MUTATION_SECRET,
        sessionId: body.sessionId as Id<"sessions">,
        github,
        level,
        eventType: body.eventType,
        screen: body.screen,
        route: body.route ?? "/",
        clientAt: typeof body.clientAt === "number" ? body.clientAt : undefined,
        summary: sanitizedSummary,
        snapshot: body.snapshot,
      });

      await recordSessionIdentity({
        convex,
        secret: ENV.CONVEX_MUTATION_SECRET,
        request,
        sessionId: body.sessionId as Id<"sessions">,
        github,
        level,
        route: body.route ?? "/api/session/replay",
        screen: body.screen,
      });

      await recordSessionFingerprint({
        convex,
        secret: ENV.CONVEX_MUTATION_SECRET,
        sessionId: body.sessionId as Id<"sessions">,
        github,
        level,
        route: body.route ?? "/api/session/replay",
        screen: body.screen,
        fingerprintHints,
      });

      return NextResponse.json({ ok: true });
    },
  );
}
