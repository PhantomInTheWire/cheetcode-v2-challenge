import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { validateGithub } from "../../../lib/validation";
import { resolveGitHubFromHeader } from "../../../lib/github-auth";
import { auth } from "../../../../auth";
import { validateLevel3Submission } from "../../../../server/level3/validation";

type RequestBody = {
  sessionId: string;
  github: string;
  code: string;
  timeElapsed: number;
};

/**
 * POST /api/finish-l3
 * Records Level 3 challenge results.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { sessionId, code, timeElapsed } = body;

    if (!sessionId || typeof code !== "string" || !code.trim()) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

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

    const ghResult = validateGithub(resolvedGithub);
    if (ghResult.ok === false) {
      return NextResponse.json({ error: ghResult.error }, { status: 400 });
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const session = await convex.query(api.submissions.getSession, {
      sessionId: sessionId as Id<"sessions">,
    });
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }

    if (session.github !== ghResult.value) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if ((session.level ?? 1) !== 3) {
      return NextResponse.json({ error: "session is not level 3" }, { status: 400 });
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
      github: ghResult.value,
      solvedProblemIds,
      timeElapsedMs: timeElapsed,
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
