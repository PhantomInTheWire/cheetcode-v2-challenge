import { NextRequest, NextResponse } from "next/server";
import { API_ROUTE_TO_ABUSE_ROUTE } from "./src/lib/abuse/config";
import { SHADOW_BAN_HEADER } from "./src/lib/abuse/guard";
import { TRUSTED_FINGERPRINT_HEADER } from "./src/lib/abuse/identity";
import { checkAndTrackAbuseInKv, isKvConfigured } from "./src/lib/abuse/kv";
import {
  CLIENT_FINGERPRINT_HEADER,
  FINGERPRINT_COOKIE,
  normalizeClientFingerprint,
} from "./src/lib/fingerprint/fingerprint-contract";
import {
  clearTrustedFingerprintCookie,
  verifyTrustedFingerprintCookieValue,
} from "./src/lib/fingerprint/server-trust";

function rateLimitBody(pathname: string): Record<string, unknown> {
  if (
    pathname === "/api/level-1/validate" ||
    pathname === "/api/level-2/validate" ||
    pathname === "/api/level-3/validate"
  ) {
    return { passed: false, error: "rate limited" };
  }
  if (pathname === "/api/level-1/finish") {
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
  if (pathname === "/api/level-2/finish" || pathname === "/api/level-3/finish") {
    return { error: "rate limited", elo: 0, solved: 0, rank: 0, timeRemaining: 0 };
  }
  return { error: "rate limited" };
}

export async function proxy(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();

  const rawFingerprintCookie = request.cookies.get(FINGERPRINT_COOKIE)?.value?.trim();
  const fingerprintCookie = await verifyTrustedFingerprintCookieValue(rawFingerprintCookie);
  const shouldClearInvalidFingerprintCookie = Boolean(rawFingerprintCookie) && !fingerprintCookie;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(SHADOW_BAN_HEADER);
  const abuseHeaders = new Headers(requestHeaders);
  if (fingerprintCookie) {
    requestHeaders.set(TRUSTED_FINGERPRINT_HEADER, fingerprintCookie.trustedFingerprint);
    abuseHeaders.set(TRUSTED_FINGERPRINT_HEADER, fingerprintCookie.trustedFingerprint);
  } else {
    requestHeaders.delete(TRUSTED_FINGERPRINT_HEADER);
    abuseHeaders.delete(TRUSTED_FINGERPRINT_HEADER);
  }

  const route = API_ROUTE_TO_ABUSE_ROUTE[request.nextUrl.pathname];
  if (!route) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (shouldClearInvalidFingerprintCookie) clearTrustedFingerprintCookie(response);
    return response;
  }

  if (!isKvConfigured() && process.env.NODE_ENV !== "test") {
    const response = NextResponse.json(
      { error: "abuse protection backend unavailable" },
      { status: 503 },
    );
    if (shouldClearInvalidFingerprintCookie) clearTrustedFingerprintCookie(response);
    return response;
  }

  if (route === "session" && !fingerprintCookie) {
    const bootstrapFingerprint = normalizeClientFingerprint(
      request.headers.get(CLIENT_FINGERPRINT_HEADER),
    );
    if (bootstrapFingerprint) {
      abuseHeaders.set(TRUSTED_FINGERPRINT_HEADER, `bootstrap:${bootstrapFingerprint}`);
    }
  }

  const abuse = await checkAndTrackAbuseInKv(
    new Request(request.url, { method: request.method, headers: abuseHeaders }),
    route,
  );
  if (!abuse) {
    const response = NextResponse.json(
      { error: "abuse protection backend unavailable" },
      { status: 503 },
    );
    if (shouldClearInvalidFingerprintCookie) clearTrustedFingerprintCookie(response);
    return response;
  }

  const limited = abuse.limited;
  const shadowBanned = abuse.shadowBanned;
  const retryAfterSeconds = abuse.retryAfterSeconds;
  if (limited) {
    const response = NextResponse.json(rateLimitBody(request.nextUrl.pathname), {
      status: 429,
      headers: { "retry-after": String(retryAfterSeconds || 1) },
    });
    if (shouldClearInvalidFingerprintCookie) clearTrustedFingerprintCookie(response);
    return response;
  }

  const responseHeaders = new Headers(requestHeaders);
  if (shadowBanned && route.endsWith("-finish")) {
    responseHeaders.set(SHADOW_BAN_HEADER, "1");
  }

  const response = NextResponse.next({ request: { headers: responseHeaders } });
  if (shouldClearInvalidFingerprintCookie) clearTrustedFingerprintCookie(response);
  return response;
}

export const proxyConfig = {
  matcher: [
    "/api/session",
    "/api/level-1/validate",
    "/api/level-2/validate",
    "/api/level-3/validate",
    "/api/level-1/finish",
    "/api/level-2/finish",
    "/api/level-3/finish",
    "/api/session/replay",
  ],
};
