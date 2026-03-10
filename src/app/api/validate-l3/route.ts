import { NextResponse } from "next/server";
import {
  sanitizeLevel3ValidationForClient,
  validateLevel3Submission,
} from "../../../../server/level3/validation";
import { acquireLevel3InflightLock, releaseLevel3InflightLock } from "../../../lib/abuse/guard";
import type { Id } from "../../../../convex/_generated/dataModel";
import { recordBuiltTelemetry } from "../../../lib/telemetry/attempt-telemetry";
import { getAssignedLevel3ChallengeId, withOwnedSessionRoute } from "../../../lib/route-handler";

/**
 * POST /api/validate-l3
 * Body: { sessionId: string, challengeId: string, code: string }
 * Runs native compile+harness inside Vercel Sandbox (Firecracker VM).
 */
export async function POST(request: Request) {
  return withOwnedSessionRoute<
    { sessionId: string; challengeId?: string; code: string },
    { challengeId: string }
  >(
    request,
    {
      expectedLevel: 3,
      validateBody: (body): body is { sessionId: string; challengeId?: string; code: string } =>
        !!body &&
        typeof body === "object" &&
        typeof (body as { sessionId?: unknown }).sessionId === "string" &&
        typeof (body as { code?: unknown }).code === "string" &&
        ((body as { challengeId?: unknown }).challengeId === undefined ||
          typeof (body as { challengeId?: unknown }).challengeId === "string"),
      invalidBodyResponse: NextResponse.json({ error: "Invalid code" }, { status: 400 }),
      errorLabel: "/api/validate-l3 error",
      errorResponse: NextResponse.json({ error: "Validation failed" }, { status: 500 }),
      deriveContext: ({ body, session }) => {
        const challengeId = getAssignedLevel3ChallengeId(session.problemIds);
        if (!challengeId) {
          return NextResponse.json({ error: "invalid level 3 session" }, { status: 400 });
        }
        if (body.challengeId && body.challengeId !== challengeId) {
          return NextResponse.json({ error: "challenge does not match session" }, { status: 400 });
        }
        return { challengeId };
      },
    },
    async ({ github, convex, session, body: { sessionId, code }, challengeId }) => {
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

        return NextResponse.json({
          ...clientResult,
          expiresAt: session.expiresAt,
        });
      } finally {
        await releaseLevel3InflightLock(inflight.lock);
      }
    },
  );
}
