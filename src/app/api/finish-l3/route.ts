import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { validateLevel3Submission } from "../../../../server/level3/validation";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse";
import { clampElapsed, shadowBanResponse } from "../../../lib/api-route";
import { ENV } from "../../../lib/env-vars";
import { withAuthenticatedSession } from "../../../lib/route-handler";

type RequestBody = {
  sessionId: string;
  code: string;
  timeElapsed: number;
};

export async function POST(request: Request) {
  return withAuthenticatedSession<RequestBody>(request, 3, async ({ github, session, convex, body }) => {
    const { sessionId, code, timeElapsed } = body;

    if (typeof code !== "string" || !code.trim() || typeof timeElapsed !== "number") {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const clientElapsedMs = clampElapsed(timeElapsed, session.expiresAt - session.startedAt);

    if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
      return shadowBanResponse(session.expiresAt - session.startedAt, clientElapsedMs);
    }

    const firstProblemId = session.problemIds[0];
    if (!firstProblemId) {
      return NextResponse.json({ error: "invalid level 3 session" }, { status: 400 });
    }
    const challengeId = firstProblemId.split(":").slice(0, 3).join(":");

    const validation = await validateLevel3Submission(challengeId, code);
    if (validation.staleSession) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    if (validation.compiled === false) {
      return NextResponse.json(
        {
          error:
            validation.error ||
            "Level 3 validation infrastructure is currently unavailable. Please retry in a moment.",
        },
        { status: 503 }
      );
    }
    const solvedProblemIds = validation.results.filter((r) => r.correct).map((r) => r.problemId);

    const result = await convex.action(api.submissions.recordResults, {
      secret: ENV.CONVEX_MUTATION_SECRET,
      sessionId: sessionId as Id<"sessions">,
      github,
      solvedProblemIds,
      timeElapsedMs: clientElapsedMs,
      exploitBonus: 0,
    });

    return NextResponse.json({
      ...result,
      validation,
    });
  });
}
