import { NextResponse } from "next/server";
import { PROBLEM_BANK } from "../../../../../server/level1/problems";
import { isServerDevMode } from "../../../../lib/myEnv";

export async function POST(request: Request) {
  // Dev-only — returns solutions for given problem IDs
  if (!isServerDevMode()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { problemIds?: string[] };
    if (!body.problemIds || !body.problemIds.length) {
      return NextResponse.json({ error: "problemIds required" }, { status: 400 });
    }

    const byId = new Map(PROBLEM_BANK.map((p) => [p.id, p]));
    const solutions: Record<string, string> = {};
    for (const id of body.problemIds) {
      const problem = byId.get(id);
      if (problem) {
        solutions[id] = problem.solution;
      }
    }

    return NextResponse.json({ solutions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "auto solve failed" },
      { status: 400 },
    );
  }
}
