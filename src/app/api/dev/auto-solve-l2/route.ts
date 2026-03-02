import { NextResponse } from "next/server";
import { LEVEL2_PROBLEMS } from "../../../../../server/level2/problems";
import { isServerDevMode } from "../../../../lib/myEnv";
import { requireAuthenticatedGithub } from "../../../../lib/request-auth";

export async function POST(request: Request) {
  if (!isServerDevMode()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;

  try {
    const body = (await request.json()) as { problemIds?: string[] };
    if (!body.problemIds || !body.problemIds.length) {
      return NextResponse.json({ error: "problemIds required" }, { status: 400 });
    }

    const answers: Record<string, string> = {};
    for (const id of body.problemIds) {
      const problem = LEVEL2_PROBLEMS.find((p) => p.id === id);
      if (problem) answers[id] = problem.answer;
    }

    return NextResponse.json({ answers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "auto solve failed" },
      { status: 400 },
    );
  }
}
