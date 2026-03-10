import { NextResponse } from "next/server";

export async function getJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export class JsonBodyTooLargeError extends Error {
  constructor(message: string = "request body too large") {
    super(message);
    this.name = "JsonBodyTooLargeError";
  }
}

export async function getJsonBodyWithLimit<T>(
  request: Request,
  maxBytes: number,
): Promise<T | null> {
  const normalizedMaxBytes = Math.max(1, Math.floor(maxBytes));
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > normalizedMaxBytes) {
      throw new JsonBodyTooLargeError();
    }
  }

  if (!request.body) return null;

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > normalizedMaxBytes) {
      throw new JsonBodyTooLargeError();
    }
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
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
