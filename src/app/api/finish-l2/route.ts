import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse-guard";
import { validateLevel2Answers } from "../../../lib/level2-validation";
import { requireOwnedSession } from "../../../lib/session-auth";
import { clampElapsed, getJsonBody, shadowBanResponse } from "../../../lib/api-route";

/**
 * POST /api/finish-l2
 * End-to-end Level 2 submission handler:
 *   1. Call Convex mutation to record results
 *   2. Return results to client/agent
 */

type RequestBody = {
  sessionId: string;
  answers: Record<string, string>;
  timeElapsed: number;
};

export async function POST(request: Request) {
  try {
    const body = await getJsonBody<RequestBody>(request);
    if (!body) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const { sessionId, answers, timeElapsed } = body;

    if (!sessionId || !answers || typeof answers !== "object" || typeof timeElapsed !== "number") {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const github = authResult.github;

    const sessionResult = await requireOwnedSession(sessionId, github, 2);
    if ("response" in sessionResult) return sessionResult.response;
    const { session, convex } = sessionResult;
    const clientElapsedMs = clampElapsed(timeElapsed, session.expiresAt - session.startedAt);

    if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
      return shadowBanResponse(session.expiresAt - session.startedAt, clientElapsedMs);
    }

    const validated = validateLevel2Answers(answers);
    const solvedProblemIds = validated.filter((r) => r.correct).map((r) => r.problemId);

    // Record results via authenticated Convex action
    const result = await convex.action(api.submissions.recordResults, {
      secret: process.env.CONVEX_MUTATION_SECRET!,
      sessionId: sessionId as Id<"sessions">,
      github,
      solvedProblemIds,
      timeElapsedMs: clientElapsedMs,
      exploitBonus: 0, // Level 2 doesn't have exploits/landmines like Level 1
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("/api/finish-l2 error:", err);
    return NextResponse.json(
      { error: "submission failed", elo: 0, solved: 0, rank: 0, timeRemaining: 0 },
      { status: 500 },
    );
  }
}
