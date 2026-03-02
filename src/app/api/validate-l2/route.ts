import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { validateLevel2Answers } from "../../../lib/level2-validation";

/**
 * POST /api/validate-l2
 * Validates Level 2 (Chromium search) answers.
 * Body: { answers: Record<string, string> } - problemId -> answer
 * Returns: { results: Array<{ problemId: string, correct: boolean }> }
 */
export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;

    const body = await request.json();
    const { answers } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json({ error: "Invalid answers format" }, { status: 400 });
    }

    const results = validateLevel2Answers(answers as Record<string, string>);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("/api/validate-l2 error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
