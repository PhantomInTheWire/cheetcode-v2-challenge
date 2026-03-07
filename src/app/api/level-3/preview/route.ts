import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/routes/authenticated-route";
import { requireUnlockedLevel } from "@/lib/session/level-access";
import { generateLevel3ChallengeMeta } from "../../../../../server/level3/catalog";

export async function GET(request: Request) {
  return withAuthenticatedRoute(request, async ({ github }) => {
    const accessResponse = await requireUnlockedLevel(github, 3);
    if (accessResponse) return accessResponse;

    const challenge = generateLevel3ChallengeMeta();
    return NextResponse.json({
      challengeId: challenge.id,
      taskName: challenge.taskName,
      language: challenge.language,
    });
  });
}
