import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse-guard";

/**
 * POST /api/finish-l2
 * End-to-end Level 2 submission handler:
 *   1. Call Convex mutation to record results
 *   2. Return results to client/agent
 */

type RequestBody = {
  sessionId: string;
  solvedProblemIds: string[];
  timeElapsed: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { sessionId, solvedProblemIds, timeElapsed } = body;

    if (!sessionId || !Array.isArray(solvedProblemIds) || typeof timeElapsed !== "number") {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const github = authResult.github;

    // Fetch session to validate
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const session = await convex.query(api.submissions.getSession, {
      sessionId: sessionId as Id<"sessions">,
    });
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }

    // Security: Verify session ownership
    if (session.github !== github) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const clientElapsedMs = Math.max(0, Math.min(session.expiresAt - session.startedAt, timeElapsed));

    if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
      return NextResponse.json({
        elo: 0,
        solved: 0,
        rank: 9999,
        timeRemaining: Math.max(0, Math.floor((session.expiresAt - session.startedAt - clientElapsedMs) / 1000)),
      });
    }

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
