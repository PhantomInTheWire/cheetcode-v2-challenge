import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { adminForbiddenResponse, isAdminGithub } from "../../../../lib/admin-auth";
import { ENV } from "../../../../lib/env-vars";
import { requireAuthenticatedGithub } from "../../../../lib/request-auth";

type ConvexQueryCaller = (reference: unknown, args: Record<string, unknown>) => Promise<unknown>;

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  if (!isAdminGithub(authResult.github)) return adminForbiddenResponse();

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const limit = Number(url.searchParams.get("limit") ?? "");
  const normalizedLimit = Number.isFinite(limit) ? limit : undefined;
  const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
  const callQuery = convex.query as unknown as ConvexQueryCaller;

  try {
    if (sessionId) {
      const detail = await callQuery(
        (api as typeof api & { sessionReplay: { getSessionReplay: unknown } }).sessionReplay
          .getSessionReplay,
        {
          sessionId: sessionId as Id<"sessions">,
          limit: normalizedLimit,
        },
      );
      return NextResponse.json(detail);
    }

    const sessions = await callQuery(
      (api as typeof api & { sessionReplay: { getRecentSessions: unknown } }).sessionReplay
        .getRecentSessions,
      { limit: normalizedLimit },
    );
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("/api/admin/replays error:", error);
    return NextResponse.json({ error: "Failed to load replay data" }, { status: 500 });
  }
}
