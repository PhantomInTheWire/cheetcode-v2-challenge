import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { SHADOW_BAN_HEADER } from "@/lib/abuse/guard";
import { validateLevel2Answers } from "@/lib/validation";
import { clampElapsed, shadowBanResponse } from "@/lib/routes/api-route";
import { ENV } from "@/lib/config/env";
import { scheduleAfter } from "@/lib/routes/safe-after";
import { withAuthenticatedSession } from "@/lib/routes/route-handler";
import { recordBuiltTelemetry } from "@/lib/telemetry/attempt-telemetry";

type RequestBody = {
  sessionId: string;
  answers: Record<string, string>;
  timeElapsed: number;
  runScoreSnapshot?: { elo?: number; solved?: number };
};

export async function POST(request: Request) {
  return withAuthenticatedSession<RequestBody>(
    request,
    {
      expectedLevel: 2,
      validateBody: (body): body is RequestBody => {
        if (!body || typeof body !== "object") return false;
        const candidate = body as Partial<RequestBody>;
        return (
          typeof candidate.sessionId === "string" &&
          !!candidate.answers &&
          typeof candidate.answers === "object" &&
          typeof candidate.timeElapsed === "number"
        );
      },
    },
    async ({ github, session, convex, body }) => {
      const { sessionId, answers, timeElapsed } = body;

      const clientElapsedMs = clampElapsed(timeElapsed, session.expiresAt - session.startedAt);

      if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
        const response = shadowBanResponse(session.expiresAt - session.startedAt, clientElapsedMs);
        scheduleAfter(async () => {
          await recordBuiltTelemetry({
            convex,
            sessionId: sessionId as Id<"sessions">,
            github,
            level: 2,
            eventType: "finish_l2",
            elapsedMs: clientElapsedMs,
            route: "/api/level-2/finish",
            status: "shadow_banned",
            errorType: "shadow_ban",
            artifact: {
              sessionId,
              answers,
            },
          });
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

      scheduleAfter(async () => {
        await recordBuiltTelemetry({
          convex,
          sessionId: sessionId as Id<"sessions">,
          github,
          level: 2,
          eventType: "finish_l2",
          elapsedMs: clientElapsedMs,
          route: "/api/level-2/finish",
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
      });

      return NextResponse.json({
        elo: result.elo,
        solved: result.solved,
        rank: result.rank,
        timeRemaining: result.timeRemaining,
        scoreSnapshot: {
          elo: result.totalElo ?? result.elo,
          solved: result.totalSolved ?? result.solved,
          rank: result.rank,
        },
        completedLevel: solvedProblemIds.length === session.problemIds.length,
      });
    },
  );
}
