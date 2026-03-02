import { NextResponse } from "next/server";

export async function getJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function clampElapsed(timeElapsedMs: number, maxElapsedMs: number): number {
  return Math.max(0, Math.min(maxElapsedMs, timeElapsedMs));
}

export function shadowBanResponse(
  totalDurationMs: number,
  elapsedMs: number,
  extras?: Record<string, unknown>,
) {
  return NextResponse.json({
    elo: 0,
    solved: 0,
    rank: 9999,
    timeRemaining: Math.max(0, Math.floor((totalDurationMs - elapsedMs) / 1000)),
    ...(extras ?? {}),
  });
}
