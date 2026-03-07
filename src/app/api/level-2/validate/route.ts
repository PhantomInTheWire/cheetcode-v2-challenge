import { NextResponse } from "next/server";
import { validateLevel2Answers } from "@/lib/validation";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { recordBuiltTelemetry } from "@/lib/telemetry/attempt-telemetry";
import { summarizeValidation } from "@/lib/api/validation-response";
import { withOwnedSessionRoute } from "@/lib/routes/route-handler";

/**
 * POST /api/level-2/validate
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
      errorLabel: "/api/level-2/validate error",
      errorResponse: NextResponse.json({ error: "Validation failed" }, { status: 500 }),
    },
    async ({ github, convex, session, body: { sessionId, answers } }) => {
      const results = validateLevel2Answers(answers, session.problemIds as string[]);
      const summary = summarizeValidation({
        passCount: results.filter((result) => result.correct).length,
        totalCount: results.length,
      });

      await recordBuiltTelemetry({
        convex,
        sessionId: sessionId as Id<"sessions">,
        github,
        level: 2,
        eventType: "validate_l2",
        route: "/api/level-2/validate",
        status: summary.status,
        passCount: summary.passCount,
        failCount: summary.failCount,
        artifact: {
          sessionId,
          answers,
          results,
        },
      });

      return NextResponse.json({
        sessionId,
        expiresAt: session.expiresAt,
        ...summary,
        results,
      });
    },
  );
}
