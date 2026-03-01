import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { validateGithub } from "../../../lib/validation";
import { resolveGitHubFromHeader } from "../../../lib/github-auth";
import { auth } from "../../../../auth";

/**
 * POST /api/finish-l2
 * End-to-end Level 2 submission handler:
 *   1. Call Convex mutation to record results
 *   2. Return results to client/agent
 */

type RequestBody = {
  sessionId: string;
  github: string;
  solvedProblemIds: string[];
  timeElapsed: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { sessionId, solvedProblemIds, timeElapsed } = body;

    if (!sessionId || !Array.isArray(solvedProblemIds)) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    // Resolve GitHub identity: PAT header > OAuth session > reject
    let resolvedGithub = await resolveGitHubFromHeader(request);
    if (!resolvedGithub) {
      const oauthSession = await auth();
      resolvedGithub = (oauthSession?.user as { githubUsername?: string })?.githubUsername ?? null;
    }

    if (!resolvedGithub) {
      return NextResponse.json(
        {
          error: "GitHub authentication required",
          hint: "Send a GitHub PAT via Authorization: Bearer <token>, or sign in with OAuth",
        },
        { status: 401 },
      );
    }

    // Server-side input validation on the resolved username
    const ghResult = validateGithub(resolvedGithub);
    if (ghResult.ok === false) {
      return NextResponse.json({ error: ghResult.error }, { status: 400 });
    }

    // Fetch session to validate
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const session = await convex.query(api.submissions.getSession, {
      sessionId: sessionId as Id<"sessions">,
    });
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }

    // Security: Verify session ownership
    if (session.github !== ghResult.value) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // Record results via authenticated Convex action
    const result = await convex.action(api.submissions.recordResults, {
      secret: process.env.CONVEX_MUTATION_SECRET!,
      sessionId: sessionId as Id<"sessions">,
      github: ghResult.value,
      solvedProblemIds,
      timeElapsedMs: timeElapsed,
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
