import { NextResponse } from "next/server";
import { LEVEL2_PROBLEMS } from "../../../../server/level2/problems";

/**
 * POST /api/validate-l2
 * Validates Level 2 (Chromium search) answers.
 * Body: { answers: Record<string, string> } - problemId -> answer
 * Returns: { results: Array<{ problemId: string, correct: boolean }> }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { answers } = body;

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Invalid answers format" },
        { status: 400 }
      );
    }

    const results = LEVEL2_PROBLEMS.map((problem) => {
      const userAnswer = (answers[problem.id] || "").trim().toLowerCase();
      const correctAnswer = problem.answer.trim().toLowerCase();
      const acceptable = [correctAnswer, ...(problem.acceptableAnswers || [])].map(a => a.trim().toLowerCase());
      
      return {
        problemId: problem.id,
        correct: acceptable.includes(userAnswer),
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("/api/validate-l2 error:", error);
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}
