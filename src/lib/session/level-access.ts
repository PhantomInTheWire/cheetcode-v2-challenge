import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api";
import { isServerDevMode } from "../config/env";
import { getConvexHttpClient } from "../convex/http-client";

export async function requireUnlockedLevel(
  github: string,
  level: 2 | 3,
): Promise<NextResponse | null> {
  if (isServerDevMode()) return null;

  const convex = getConvexHttpClient();
  const unlockedLevel = await convex.query(api.leaderboard.getMyLevel, { github });
  if ((unlockedLevel ?? 1) >= level) {
    return null;
  }

  return NextResponse.json(
    { error: `level ${level} is locked until the previous level is cleared` },
    { status: 403 },
  );
}
