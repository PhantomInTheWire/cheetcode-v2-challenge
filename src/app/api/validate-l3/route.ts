import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import {
  sanitizeLevel3ValidationForClient,
  validateLevel3Submission,
} from "../../../../server/level3/validation";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { requireOwnedSession } from "../../../lib/session-auth";
import {
  acquireLevel3InflightLock,
  releaseLevel3InflightLock,
} from "../../../lib/abuse/guard";
import type { Id } from "../../../../convex/_generated/dataModel";
import { recordBuiltTelemetry } from "../../../lib/attempt-telemetry";
import { ENV } from "../../../lib/env-vars";

/**
 * POST /api/validate-l3
 * Body: { sessionId: string, challengeId: string, code: string }
 * Runs native compile+harness inside Vercel Sandbox (Firecracker VM).
 */
export async function POST(request: Request) {
  try {
    const requestStartedAt = Date.now();
    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const { github } = authResult;

    const body = await request.json();
    const { sessionId, challengeId, code } = body as {
      sessionId?: string;
      challengeId?: string;
      code?: string;
    };

    if (
      !sessionId ||
      !challengeId ||
      typeof challengeId !== "string" ||
      !code ||
      typeof code !== "string"
    ) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const sessionResult = await requireOwnedSession(sessionId, github, 3);
    if ("response" in sessionResult) return sessionResult.response;

    const {
      convex,
      session: { problemIds },
    } = sessionResult;
    const assignedProblemId = problemIds[0];
    const assignedChallengeId = assignedProblemId?.split(":").slice(0, 3).join(":");
    if (!assignedChallengeId || challengeId !== assignedChallengeId) {
      return NextResponse.json({ error: "challenge does not match session" }, { status: 400 });
    }

    const inflight = acquireLevel3InflightLock(request, github);
    if (!inflight.ok) {
      return NextResponse.json({ error: "level3 submission already in flight" }, { status: 409 });
    }

    try {
      const result = await validateLevel3Submission(challengeId, code);
      const clientResult = sanitizeLevel3ValidationForClient(result);

      const passCount = result.results.filter((row) => row.correct).length;
      const status =
        result.compiled === false
          ? "failed"
          : passCount === 0
            ? "failed"
            : passCount === result.results.length
              ? "passed"
              : "partial";
      const errorType = result.compiled === false ? "compile" : undefined;

      await recordBuiltTelemetry({
        convex,
        sessionId: sessionId as Id<"sessions">,
        github,
        level: 3,
        eventType: "validate_l3",
        route: "/api/validate-l3",
        status,
        errorType,
        passCount,
        failCount: result.results.length - passCount,
        summary: {
          compileError: result.compiled === false ? result.error : null,
          staleSession: result.staleSession === true,
        },
        artifact: {
          sessionId,
          challengeId,
          code,
          validation: result,
        },
      });

      const pauseMs = Math.max(0, Date.now() - requestStartedAt);
      const extension = await convex.action(api.sessions.extendExpiry, {
        secret: ENV.CONVEX_MUTATION_SECRET,
        sessionId: sessionId as Id<"sessions">,
        github,
        extendMs: pauseMs,
      });

      return NextResponse.json({
        ...clientResult,
        expiresAt: extension.expiresAt,
      });
    } finally {
      releaseLevel3InflightLock(inflight.lock);
    }
  } catch (error) {
    console.error("/api/validate-l3 error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
