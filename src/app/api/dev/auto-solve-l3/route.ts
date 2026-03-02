import { NextResponse } from "next/server";
import { getLevel3ChallengeFromId } from "../../../../../server/level3/problems";
import { getLevel3AutoSolveCode } from "../../../../../server/level3/autoSolve";
import { isServerDevMode } from "../../../../lib/myEnv";

export async function POST(request: Request) {
  if (!isServerDevMode()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const body = (await request.json()) as { challengeId?: string };
    if (!body.challengeId) {
      return NextResponse.json({ error: "challengeId required" }, { status: 400 });
    }

    const challenge = getLevel3ChallengeFromId(body.challengeId);
    if (!challenge) {
      return NextResponse.json({ error: "unknown challenge" }, { status: 400 });
    }

    const code = getLevel3AutoSolveCode(challenge.language);
    return NextResponse.json({ code });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "auto solve failed" },
      { status: 400 },
    );
  }
}
