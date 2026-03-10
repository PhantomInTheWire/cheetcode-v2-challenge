import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  sanitizeLevel3ValidationForClient,
  validateLevel3Submission,
} from "../../../../server/level3/validation";
import { acquireLevel3InflightLock, releaseLevel3InflightLock } from "../../../lib/abuse/guard";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse/guard";
import { clampElapsed, shadowBanResponse } from "../../../lib/api-route";
import { ENV } from "../../../lib/env-vars";
import { LEVEL3_FINISH_EXPIRY_GRACE_MS, withOwnedSessionRoute } from "../../../lib/route-handler";
import { getAssignedLevel3ChallengeId } from "../../../lib/session/session-payload";
import { recordBuiltTelemetry } from "../../../lib/telemetry/attempt-telemetry";

type RequestBody = {
  sessionId: string;
  code: string;
  timeElapsed: number;
  runScoreSnapshot?: { elo?: number; solved?: number };
};

export async function POST(request: Request) {
  return withOwnedSessionRoute<RequestBody>(
    request,
    {
      expectedLevel: 3,
      expiryGraceMs: LEVEL3_FINISH_EXPIRY_GRACE_MS,
      validateBody: (body): body is RequestBody =>
        !!body &&
        typeof body === "object" &&
        typeof (body as { sessionId?: unknown }).sessionId === "string" &&
        typeof (body as { code?: unknown }).code === "string" &&
        typeof (body as { timeElapsed?: unknown }).timeElapsed === "number",
      errorLabel: "Route handler error (Level 3)",
      errorResponse: NextResponse.json(
        { error: "internal server error", elo: 0, solved: 0, rank: 0, timeRemaining: 0 },
        { status: 500 },
      ),
    },
    async ({ github, session, convex, body }) => {
      const requestStartedAt = Date.now();
      const { sessionId, code, timeElapsed } = body;
      const extendSessionPause = async () => {
        const pauseMs = Math.max(0, Date.now() - requestStartedAt);
        return await convex.action(api.sessions.extendExpiry, {
          secret: ENV.CONVEX_MUTATION_SECRET,
          sessionId: sessionId as Id<"sessions">,
          github,
          extendMs: pauseMs,
        });
      };

      if (!code.trim()) {
        return NextResponse.json({ error: "invalid request" }, { status: 400 });
      }

      const roundDurationMs = session.expiresAt - session.startedAt;
      const clientElapsedMs = clampElapsed(timeElapsed, roundDurationMs);

      if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
        const response = shadowBanResponse(roundDurationMs, clientElapsedMs);
        await recordBuiltTelemetry({
          convex,
          sessionId: sessionId as Id<"sessions">,
          github,
          level: 3,
          eventType: "finish_l3",
          elapsedMs: clientElapsedMs,
          route: "/api/finish-l3",
          status: "shadow_banned",
          errorType: "shadow_ban",
          artifact: {
            sessionId,
            code,
          },
        });
        await extendSessionPause();
        return response;
      }

      const challengeId = getAssignedLevel3ChallengeId(session.problemIds);
      if (!challengeId) {
        return NextResponse.json({ error: "invalid level 3 session" }, { status: 400 });
      }

      const inflight = await acquireLevel3InflightLock(request, github);
      if (inflight.ok === false) {
        return NextResponse.json(
          {
            error:
              inflight.reason === "unavailable"
                ? "abuse protection backend unavailable"
                : "level3 submission already in flight",
          },
          { status: inflight.reason === "unavailable" ? 503 : 409 },
        );
      }

      try {
        const validation = await validateLevel3Submission(challengeId, code);
        const clientValidation = sanitizeLevel3ValidationForClient(validation);

        if (validation.staleSession) {
          await recordBuiltTelemetry({
            convex,
            sessionId: sessionId as Id<"sessions">,
            github,
            level: 3,
            eventType: "finish_l3",
            elapsedMs: clientElapsedMs,
            route: "/api/finish-l3",
            status: "failed",
            errorType: "invalid_request",
            summary: {
              staleSession: true,
            },
            artifact: {
              sessionId,
              challengeId,
              code,
              validation,
            },
          });
          const extension = await extendSessionPause();
          return NextResponse.json(
            {
              error: validation.error,
              expiresAt: extension.expiresAt,
            },
            { status: 400 },
          );
        }

        if (validation.compiled === false) {
          await recordBuiltTelemetry({
            convex,
            sessionId: sessionId as Id<"sessions">,
            github,
            level: 3,
            eventType: "finish_l3",
            elapsedMs: clientElapsedMs,
            route: "/api/finish-l3",
            status: "infra_error",
            errorType: "compile",
            summary: {
              compileError: validation.error,
            },
            artifact: {
              sessionId,
              challengeId,
              code,
              validation,
            },
          });
          const extension = await extendSessionPause();
          return NextResponse.json(
            {
              error: clientValidation.error,
              expiresAt: extension.expiresAt,
            },
            { status: 503 },
          );
        }

        const solvedProblemIds = validation.results
          .filter((r) => r.correct)
          .map((r) => r.problemId);
        const result = await convex.action(api.submissions.recordResults, {
          secret: ENV.CONVEX_MUTATION_SECRET,
          sessionId: sessionId as Id<"sessions">,
          github,
          solvedProblemIds,
          timeElapsedMs: clientElapsedMs,
          exploitBonus: 0,
        });

        const status =
          solvedProblemIds.length === 0
            ? "failed"
            : solvedProblemIds.length === validation.results.length
              ? "passed"
              : "partial";

        await recordBuiltTelemetry({
          convex,
          sessionId: sessionId as Id<"sessions">,
          github,
          level: 3,
          eventType: "finish_l3",
          elapsedMs: clientElapsedMs,
          route: "/api/finish-l3",
          status,
          solvedCount: solvedProblemIds.length,
          passCount: solvedProblemIds.length,
          failCount: validation.results.length - solvedProblemIds.length,
          artifact: {
            sessionId,
            challengeId,
            code,
            validation,
            solvedProblemIds,
            result,
          },
        });

        return NextResponse.json({
          ...result,
          validation: clientValidation,
        });
      } finally {
        await releaseLevel3InflightLock(inflight.lock);
      }
    },
  );
}
