import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse";
import { validateLevel2Answers } from "../../../lib/level2-validation";
import { clampElapsed, shadowBanResponse } from "../../../lib/api-route";
import { ENV } from "../../../lib/env-vars";
import { withAuthenticatedSession } from "../../../lib/route-handler";
import { recordBuiltTelemetry } from "../../../lib/attempt-telemetry";

type RequestBody = {
  sessionId: string;
  answers: Record<string, string>;
  timeElapsed: number;
};

export async function POST(request: Request) {
  return withAuthenticatedSession<RequestBody>(
    request,
    2,
    async ({ github, session, convex, body }) => {
      const { sessionId, answers, timeElapsed } = body;

      if (!answers || typeof answers !== "object" || typeof timeElapsed !== "number") {
        return NextResponse.json({ error: "invalid request" }, { status: 400 });
      }

      const clientElapsedMs = clampElapsed(timeElapsed, session.expiresAt - session.startedAt);

      if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
        const response = shadowBanResponse(session.expiresAt - session.startedAt, clientElapsedMs);
        await recordBuiltTelemetry({
          convex,
          sessionId: sessionId as Id<"sessions">,
          github,
          level: 2,
          eventType: "finish_l2",
          elapsedMs: clientElapsedMs,
          route: "/api/finish-l2",
          status: "shadow_banned",
          errorType: "shadow_ban",
          artifact: {
            sessionId,
            answers,
          },
        });
        return response;
      }

      const validated = validateLevel2Answers(answers, session.problemIds as string[]);
      const solvedProblemIds = validated.filter((r) => r.correct).map((r) => r.problemId);

      // Record results via authenticated Convex action
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
          : solvedProblemIds.length === session.problemIds.length
            ? "passed"
            : "partial";

      await recordBuiltTelemetry({
        convex,
        sessionId: sessionId as Id<"sessions">,
        github,
        level: 2,
        eventType: "finish_l2",
        elapsedMs: clientElapsedMs,
        route: "/api/finish-l2",
        status,
        solvedCount: solvedProblemIds.length,
        passCount: solvedProblemIds.length,
        failCount: validated.length - solvedProblemIds.length,
        artifact: {
          sessionId,
          answers,
          validated,
          solvedProblemIds,
          result,
        },
      });

      return NextResponse.json(result);
    },
  );
}
