import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { validateLevel3Submission } from "../../../../server/level3/validation";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse-guard";
import { requireOwnedSession } from "../../../lib/session-auth";
import { clampElapsed, getJsonBody, shadowBanResponse } from "../../../lib/api-route";

type RequestBody = {
  sessionId: string;
  code: string;
  timeElapsed: number;
};

/**
 * POST /api/finish-l3
 * Records Level 3 challenge results.
 */
export async function POST(request: Request) {
  try {
    const body = await getJsonBody<RequestBody>(request);
    if (!body) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const { sessionId, code, timeElapsed } = body;

    if (!sessionId || typeof code !== "string" || !code.trim() || typeof timeElapsed !== "number") {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const github = authResult.github;

    const sessionResult = await requireOwnedSession(sessionId, github, 3);
    if ("response" in sessionResult) return sessionResult.response;
    const { session, convex } = sessionResult;

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
        { status: 503 },
      );
    }
    const solvedProblemIds = validation.results.filter((r) => r.correct).map((r) => r.problemId);

    const result = await convex.action(api.submissions.recordResults, {
      secret: process.env.CONVEX_MUTATION_SECRET!,
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
  } catch (err) {
    console.error("/api/finish-l3 error:", err);
    return NextResponse.json(
      { error: "submission failed", elo: 0, solved: 0, rank: 0, timeRemaining: 0 },
      { status: 500 },
    );
  }
}
