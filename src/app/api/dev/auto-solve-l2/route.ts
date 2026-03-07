import { NextResponse } from "next/server";
import { LEVEL2_PROBLEMS } from "../../../../../server/level2/problems";
import { withDevRoute } from "../../../../lib/routes/dev-route";

const LEVEL2_PROBLEMS_BY_ID = new Map(LEVEL2_PROBLEMS.map((problem) => [problem.id, problem]));

export async function POST(request: Request) {
  return withDevRoute<{ problemIds: string[] }>(
    request,
    {
      validateBody: (body): body is { problemIds: string[] } => {
        if (!body || typeof body !== "object") return false;
        const { problemIds } = body as { problemIds?: unknown };
        return (
          Array.isArray(problemIds) &&
          problemIds.length > 0 &&
          problemIds.every((problemId) => typeof problemId === "string")
        );
      },
      invalidBodyMessage: "problemIds required",
      errorMessage: "auto solve failed",
    },
    async ({ body }) => {
      const answers: Record<string, string> = {};
      for (const id of body.problemIds) {
        const problem = LEVEL2_PROBLEMS_BY_ID.get(id);
        if (problem) answers[id] = problem.answer;
      }

      return NextResponse.json({ answers });
    },
  );
}
