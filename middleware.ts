import { NextRequest, NextResponse } from "next/server";
import {
  API_ROUTE_TO_ABUSE_ROUTE,
  SHADOW_BAN_HEADER,
  checkAndTrackAbuse,
} from "./src/lib/abuse-guard";

function rateLimitBody(pathname: string): Record<string, unknown> {
  if (pathname === "/api/validate") {
    return { passed: false, error: "rate limited" };
  }
  if (pathname === "/api/finish") {
    return { error: "rate limited", elo: 0, solved: 0, rank: 0, timeRemaining: 0, exploits: [], landmines: [] };
  }
  if (pathname === "/api/finish-l2" || pathname === "/api/finish-l3") {
    return { error: "rate limited", elo: 0, solved: 0, rank: 0, timeRemaining: 0 };
  }
  return { error: "rate limited" };
}

export function middleware(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();

  const route = API_ROUTE_TO_ABUSE_ROUTE[request.nextUrl.pathname];
  if (!route) return NextResponse.next();

  const abuse = checkAndTrackAbuse(request, route);
  if (abuse.limited) {
    return NextResponse.json(rateLimitBody(request.nextUrl.pathname), {
      status: 429,
      headers: { "retry-after": String(abuse.retryAfterSeconds) },
    });
  }

  if (!abuse.shadowBanned) return NextResponse.next();
  if (!route.startsWith("finish")) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.set(SHADOW_BAN_HEADER, "1");
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: [
    "/api/session",
    "/api/validate",
    "/api/validate-batch",
    "/api/validate-l2",
    "/api/validate-l3",
    "/api/finish",
    "/api/finish-l2",
    "/api/finish-l3",
  ],
};
