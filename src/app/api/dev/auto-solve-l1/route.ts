import { NextResponse } from "next/server";
import { PROBLEM_BANK } from "../../../../../server/level1/problems";
import { withDevRoute } from "../../../../lib/routes/dev-route";

const PROBLEM_BANK_BY_ID = new Map(PROBLEM_BANK.map((problem) => [problem.id, problem]));

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
      const solutions: Record<string, string> = {};
      for (const id of body.problemIds) {
        const problem = PROBLEM_BANK_BY_ID.get(id);
        if (problem) {
          solutions[id] = problem.solution;
        }
      }

      return NextResponse.json({ solutions });
    },
  );
}
