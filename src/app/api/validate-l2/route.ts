import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { validateLevel2Answers } from "../../../lib/level2-validation";
import { requireOwnedSession } from "../../../lib/session-auth";
import type { Id } from "../../../../convex/_generated/dataModel";
import { recordBuiltTelemetry } from "../../../lib/attempt-telemetry";

/**
 * POST /api/validate-l2
 * Validates Level 2 (Chromium search) answers.
 * Body: { sessionId: string, answers: Record<string, string> } - problemId -> answer
 * Returns: { results: Array<{ problemId: string, correct: boolean }> }
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const { github } = authResult;

    const body = await request.json();
    const { sessionId, answers } = body as {
      sessionId?: string;
      answers?: Record<string, string>;
    };

    if (!sessionId || !answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Invalid answers format" }, { status: 400 });
    }

    const sessionResult = await requireOwnedSession(sessionId, github, 2);
    if ("response" in sessionResult) return sessionResult.response;

    const { convex } = sessionResult;
    const results = validateLevel2Answers(answers as Record<string, string>);
    const correctCount = results.filter((result) => result.correct).length;

    await recordBuiltTelemetry({
      convex,
      sessionId: sessionId as Id<"sessions">,
      github,
      level: 2,
      eventType: "validate_l2",
      route: "/api/validate-l2",
      status: correctCount === 0 ? "failed" : correctCount === results.length ? "passed" : "partial",
      passCount: correctCount,
      failCount: results.length - correctCount,
      artifact: {
        sessionId,
        answers,
        results,
      },
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("/api/validate-l2 error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
