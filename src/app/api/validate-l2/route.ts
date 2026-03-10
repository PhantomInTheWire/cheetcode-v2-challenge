import { NextResponse } from "next/server";
import { validateLevel2Answers } from "../../../lib/level2-validation";
import type { Id } from "../../../../convex/_generated/dataModel";
import { recordBuiltTelemetry } from "../../../lib/telemetry/attempt-telemetry";
import { withOwnedSessionRoute } from "../../../lib/route-handler";

/**
 * POST /api/validate-l2
 * Validates Level 2 (multi-project source challenge) answers.
 * Body: { sessionId: string, answers: Record<string, string> } - problemId -> answer
 * Returns: { results: Array<{ problemId: string, correct: boolean }> }
 */
export async function POST(request: Request) {
  return withOwnedSessionRoute<{ sessionId: string; answers: Record<string, string> }>(
    request,
    {
      expectedLevel: 2,
      validateBody: (body): body is { sessionId: string; answers: Record<string, string> } =>
        !!body &&
        typeof body === "object" &&
        typeof (body as { sessionId?: unknown }).sessionId === "string" &&
        !!(body as { answers?: unknown }).answers &&
        typeof (body as { answers?: unknown }).answers === "object" &&
        !Array.isArray((body as { answers?: unknown }).answers),
      invalidBodyResponse: NextResponse.json({ error: "Invalid answers format" }, { status: 400 }),
      errorLabel: "/api/validate-l2 error",
      errorResponse: NextResponse.json({ error: "Validation failed" }, { status: 500 }),
    },
    async ({ github, convex, session, body: { sessionId, answers } }) => {
      const results = validateLevel2Answers(answers, session.problemIds as string[]);
      const correctCount = results.filter((result) => result.correct).length;

      await recordBuiltTelemetry({
        convex,
        sessionId: sessionId as Id<"sessions">,
        github,
        level: 2,
        eventType: "validate_l2",
        route: "/api/validate-l2",
        status:
          correctCount === 0 ? "failed" : correctCount === results.length ? "passed" : "partial",
        passCount: correctCount,
        failCount: results.length - correctCount,
        artifact: {
          sessionId,
          answers,
          results,
        },
      });

      return NextResponse.json({ results });
    },
  );
}
