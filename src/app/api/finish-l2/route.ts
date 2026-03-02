import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse";
import { validateLevel2Answers } from "../../../lib/level2-validation";
import { clampElapsed, shadowBanResponse } from "../../../lib/api-route";
import { ENV } from "../../../lib/env-vars";
import { withAuthenticatedSession } from "../../../lib/route-handler";

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
        return shadowBanResponse(session.expiresAt - session.startedAt, clientElapsedMs);
      }

      const validated = validateLevel2Answers(answers);
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

      return NextResponse.json(result);
    },
  );
}
