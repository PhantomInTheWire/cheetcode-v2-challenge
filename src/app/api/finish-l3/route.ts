import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
  sanitizeLevel3ValidationForClient,
  validateLevel3Submission,
} from "../../../../server/level3/validation";
import { acquireLevel3InflightLock, releaseLevel3InflightLock } from "../../../lib/abuse/guard";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse";
import { clampElapsed, shadowBanResponse } from "../../../lib/api-route";
import { ENV } from "../../../lib/env-vars";
import { withAuthenticatedSession } from "../../../lib/route-handler";
import { recordBuiltTelemetry } from "../../../lib/attempt-telemetry";

type RequestBody = {
  sessionId: string;
  code: string;
  timeElapsed: number;
};

export async function POST(request: Request) {
  return withAuthenticatedSession<RequestBody>(
    request,
    3,
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

      if (typeof code !== "string" || !code.trim() || typeof timeElapsed !== "number") {
        return NextResponse.json({ error: "invalid request" }, { status: 400 });
      }

      const clientElapsedMs = clampElapsed(timeElapsed, session.expiresAt - session.startedAt);

      if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
        const response = shadowBanResponse(session.expiresAt - session.startedAt, clientElapsedMs);
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

      const firstProblemId = session.problemIds[0];
      if (!firstProblemId) {
        return NextResponse.json({ error: "invalid level 3 session" }, { status: 400 });
      }
      const challengeId = firstProblemId.split(":").slice(0, 3).join(":");

      const inflight = acquireLevel3InflightLock(request, github);
      if (!inflight.ok) {
        return NextResponse.json({ error: "level3 submission already in flight" }, { status: 409 });
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
          await extendSessionPause();
          return NextResponse.json({ error: validation.error }, { status: 400 });
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
        releaseLevel3InflightLock(inflight.lock);
      }
    },
  );
}
