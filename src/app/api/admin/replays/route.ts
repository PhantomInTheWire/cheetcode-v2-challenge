import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ENV } from "../../../../lib/config/env";
import { withAdminConvexRoute } from "../../../../lib/routes/admin-route";

export async function GET(request: Request) {
  return withAdminConvexRoute(request, async ({ convex }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const rawLimit = url.searchParams.get("limit");
    const parsedLimit = rawLimit ? Number(rawLimit) : Number.NaN;
    const normalizedLimit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;

    try {
      if (sessionId) {
        const detail = await convex.query(
          (api as typeof api & { sessionReplay: { getSessionReplay: unknown } }).sessionReplay
            .getSessionReplay,
          {
            secret: ENV.CONVEX_MUTATION_SECRET,
            sessionId: sessionId as Id<"sessions">,
            limit: normalizedLimit,
          },
        );
        return NextResponse.json(detail);
      }

      const sessions = await convex.query(
        (api as typeof api & { sessionReplay: { getRecentSessions: unknown } }).sessionReplay
          .getRecentSessions,
        { secret: ENV.CONVEX_MUTATION_SECRET, limit: normalizedLimit },
      );
      return NextResponse.json({ sessions });
    } catch (error) {
      console.error("/api/admin/replays error:", error);
      return NextResponse.json({ error: "Failed to load replay data" }, { status: 500 });
    }
  });
}
