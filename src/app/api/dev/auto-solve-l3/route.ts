import { NextResponse } from "next/server";
import { getLevel3ChallengeFromId } from "../../../../../server/level3/problems";
import { getLevel3AutoSolveCode } from "../../../../../server/level3/autoSolve";
import { withDevRoute } from "../../../../lib/routes/dev-route";

export async function POST(request: Request) {
  return withDevRoute<{ challengeId: string }>(
    request,
    {
      validateBody: (body): body is { challengeId: string } => {
        if (!body || typeof body !== "object") return false;
        return typeof (body as { challengeId?: unknown }).challengeId === "string";
      },
      invalidBodyMessage: "challengeId required",
      errorMessage: "auto solve failed",
    },
    async ({ body }) => {
      const challenge = getLevel3ChallengeFromId(body.challengeId);
      if (!challenge) {
        return NextResponse.json({ error: "unknown challenge" }, { status: 400 });
      }

      const code = getLevel3AutoSolveCode(challenge.language, challenge.taskId);
      return NextResponse.json({ code });
    },
  );
}
