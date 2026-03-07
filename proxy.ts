import { NextRequest, NextResponse } from "next/server";
import {
  API_ROUTE_TO_ABUSE_ROUTE,
  SHADOW_BAN_HEADER,
  TRUSTED_FINGERPRINT_HEADER,
  checkAndTrackAbuse,
  checkAndTrackAbuseInKv,
} from "./src/lib/abuse";

const FINGERPRINT_COOKIE = "ctf_fp";
const FINGERPRINT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function setFingerprintCookie(response: NextResponse, value: string): void {
  response.cookies.set(FINGERPRINT_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: FINGERPRINT_COOKIE_MAX_AGE,
  });
}

function isFallbackFingerprint(value: string | undefined): boolean {
  return value?.startsWith("fallback-") ?? false;
}

function rateLimitBody(pathname: string): Record<string, unknown> {
  if (
    pathname === "/api/validate-l1" ||
    pathname === "/api/validate-batch" ||
    pathname === "/api/validate-l2" ||
    pathname === "/api/validate-l3"
  ) {
    return { passed: false, error: "rate limited" };
  }
  if (pathname === "/api/finish-l1") {
    return {
      error: "rate limited",
      elo: 0,
      solved: 0,
      rank: 0,
      timeRemaining: 0,
      exploits: [],
      landmines: [],
    };
  }
  if (pathname === "/api/finish-l2" || pathname === "/api/finish-l3") {
    return { error: "rate limited", elo: 0, solved: 0, rank: 0, timeRemaining: 0 };
  }
  return { error: "rate limited" };
}

export async function proxy(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();

  const fingerprintCookie = request.cookies.get(FINGERPRINT_COOKIE)?.value?.trim();
  const rawClientFingerprint = request.headers.get("x-client-fingerprint")?.trim();
  const normalizedClientFingerprint =
    rawClientFingerprint && /^[A-Za-z0-9._-]{8,128}$/.test(rawClientFingerprint)
      ? rawClientFingerprint
      : "";
  const shouldPromoteClientFingerprint =
    !!normalizedClientFingerprint &&
    (!fingerprintCookie ||
      (isFallbackFingerprint(fingerprintCookie) &&
        !isFallbackFingerprint(normalizedClientFingerprint)));
  const fingerprint = shouldPromoteClientFingerprint
    ? normalizedClientFingerprint
    : fingerprintCookie || normalizedClientFingerprint || crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(SHADOW_BAN_HEADER);
  requestHeaders.set(TRUSTED_FINGERPRINT_HEADER, fingerprint);

  const route = API_ROUTE_TO_ABUSE_ROUTE[request.nextUrl.pathname];
  if (!route) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (!fingerprintCookie || shouldPromoteClientFingerprint) {
      setFingerprintCookie(response, fingerprint);
    }
    return response;
  }

  const kvAbuse = await checkAndTrackAbuseInKv(
    new Request(request.url, { method: request.method, headers: requestHeaders }),
    route,
  );
  const abuse =
    kvAbuse ??
    checkAndTrackAbuse(
      new Request(request.url, { method: request.method, headers: requestHeaders }),
      route,
    );

  const limited = abuse.limited;
  const shadowBanned = abuse.shadowBanned;
  const retryAfterSeconds = abuse.retryAfterSeconds;
  if (limited) {
    const response = NextResponse.json(rateLimitBody(request.nextUrl.pathname), {
      status: 429,
      headers: { "retry-after": String(retryAfterSeconds || 1) },
    });
    if (!fingerprintCookie || shouldPromoteClientFingerprint) {
      setFingerprintCookie(response, fingerprint);
    }
    return response;
  }

  const responseHeaders = new Headers(requestHeaders);
  if (shadowBanned && route.startsWith("finish")) {
    responseHeaders.set(SHADOW_BAN_HEADER, "1");
  }

  const response = NextResponse.next({ request: { headers: responseHeaders } });
  if (!fingerprintCookie || shouldPromoteClientFingerprint) {
    setFingerprintCookie(response, fingerprint);
  }
  return response;
}

export const proxyConfig = {
  matcher: [
    "/api/session",
    "/api/validate-l1",
    "/api/validate-batch",
    "/api/validate-l2",
    "/api/validate-l3",
    "/api/finish-l1",
    "/api/finish-l2",
    "/api/finish-l3",
    "/api/session/replay",
  ],
};
