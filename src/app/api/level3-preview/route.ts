import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { generateLevel3ChallengeMeta } from "../../../../server/level3/catalog";

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;

  const challenge = generateLevel3ChallengeMeta();
  return NextResponse.json({
    challengeId: challenge.id,
    taskName: challenge.taskName,
    language: challenge.language,
  });
}
