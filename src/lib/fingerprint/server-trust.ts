import type { NextResponse } from "next/server";
import {
  CLIENT_FINGERPRINT_HEADER,
  FINGERPRINT_COOKIE,
  normalizeClientFingerprint,
} from "./fingerprint-contract";
import type { UnverifiedFingerprintHints } from "./fingerprint-shared";

const FINGERPRINT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const TRUSTED_FINGERPRINT_PREFIX = "srvfp-";
const TOKEN_VERSION = "v2";
let hasWarnedAboutMissingSigningSecret = false;

type StoredFingerprintHashes = {
  fingerprintIdHash: string;
  profileHash: string;
  environmentHash: string;
  displayHash: string;
  stableDisplayHash: string;
  renderingHash: string;
  deviceClusterKey: string;
  stableDeviceClusterKey: string;
  localeClusterKey: string;
};

type FingerprintPromotionDecision =
  | "minted_new_cookie"
  | "reused_existing_cookie"
  | "reused_existing_cookie_due_to_major_drift"
  | "route_does_not_mint"
  | "missing_fingerprint_id"
  | "fallback_fingerprint_source"
  | "client_header_missing"
  | "client_header_mismatch";

type FingerprintDriftStatus = "none" | "major";

export type TrustedFingerprintCookiePayload = {
  tokenVersion: typeof TOKEN_VERSION;
  trustedFingerprint: string;
  fingerprintSource: "fingerprintjs";
  hashes: Pick<
    StoredFingerprintHashes,
    "fingerprintIdHash" | "stableDeviceClusterKey" | "localeClusterKey" | "renderingHash"
  >;
  requestSignals: {
    userAgentHash: string;
    acceptLanguageHash: string;
  };
};

export type ServerVerifiedFingerprintSummary = UnverifiedFingerprintHints & {
  hashes: StoredFingerprintHashes;
  trustedFingerprint: string;
  requestSignals: {
    userAgentHash: string;
    acceptLanguageHash: string;
  };
  trust: {
    clientFingerprintHeader: string;
    claimedFingerprintIdMatchesHeader: boolean;
    existingCookieStatus: "present" | "absent";
    activeTrustedFingerprint: string | null;
    promotionEligible: boolean;
    promotionDecision: FingerprintPromotionDecision;
    driftStatus: FingerprintDriftStatus;
    driftReasons: string[];
  };
};

export type ResolvedFingerprintTrust = {
  summary?: ServerVerifiedFingerprintSummary;
  existingCookie: TrustedFingerprintCookiePayload | null;
  cookiePayloadToSet: TrustedFingerprintCookiePayload | null;
};

function hashValue(raw: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ 0x9e3779b9;
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function base64UrlEncode(raw: string): string {
  const bytes = new TextEncoder().encode(raw);
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  const base64 =
    typeof btoa === "function" ? btoa(binary) : Buffer.from(raw, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(raw: string): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    if (typeof atob === "function") {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function normalizeString(value: string | undefined, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

function normalizeStringArray(values: string[] | undefined, maxLength: number): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => normalizeString(value, maxLength)).filter(Boolean)),
  );
}

function normalizeNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getSigningSecret(): string {
  const secret = (
    process.env.FINGERPRINT_COOKIE_SECRET ??
    process.env.CONVEX_MUTATION_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    ""
  ).trim();
  if (!secret && !hasWarnedAboutMissingSigningSecret) {
    hasWarnedAboutMissingSigningSecret = true;
    console.warn(
      "[fingerprint-trust] missing signing secret; trusted fingerprint cookies cannot be issued",
    );
  }
  return secret;
}

async function signValue(raw: string): Promise<string> {
  const secret = getSigningSecret();
  if (!secret) return "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(raw));
  return toHex(signature);
}

function safeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) {
    mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return mismatch === 0;
}

function extractCookieValue(request: Request, cookieName: string): string | undefined {
  const rawCookieHeader = request.headers.get("cookie");
  if (!rawCookieHeader) return undefined;
  for (const part of rawCookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === cookieName) return rest.join("=");
  }
  return undefined;
}

function buildStableDisplay(display: ServerVerifiedFingerprintSummary["display"]) {
  return {
    screenWidth: display.screenWidth,
    screenHeight: display.screenHeight,
    devicePixelRatio: display.devicePixelRatio,
  };
}

function buildTrustCookiePayload(
  summary: ServerVerifiedFingerprintSummary,
): TrustedFingerprintCookiePayload {
  return {
    tokenVersion: TOKEN_VERSION,
    trustedFingerprint: summary.trustedFingerprint,
    fingerprintSource: "fingerprintjs",
    hashes: {
      fingerprintIdHash: summary.hashes.fingerprintIdHash,
      stableDeviceClusterKey: summary.hashes.stableDeviceClusterKey,
      localeClusterKey: summary.hashes.localeClusterKey,
      renderingHash: summary.hashes.renderingHash,
    },
    requestSignals: summary.requestSignals,
  };
}

function classifyPromotionEligibility(summary: ServerVerifiedFingerprintSummary): {
  eligible: boolean;
  decision:
    | "missing_fingerprint_id"
    | "fallback_fingerprint_source"
    | "client_header_missing"
    | "client_header_mismatch";
} | null {
  if (!summary.fingerprintId || summary.fingerprintId === "unknown") {
    return { eligible: false, decision: "missing_fingerprint_id" };
  }
  if (summary.fingerprintSource !== "fingerprintjs") {
    return { eligible: false, decision: "fallback_fingerprint_source" };
  }
  if (!summary.trust.clientFingerprintHeader) {
    return { eligible: false, decision: "client_header_missing" };
  }
  if (!summary.trust.claimedFingerprintIdMatchesHeader) {
    return { eligible: false, decision: "client_header_mismatch" };
  }
  return null;
}

function assessFingerprintDrift(
  existingCookie: TrustedFingerprintCookiePayload,
  summary: ServerVerifiedFingerprintSummary,
): { status: FingerprintDriftStatus; reasons: string[] } {
  const reasons: string[] = [];

  if (existingCookie.hashes.fingerprintIdHash !== summary.hashes.fingerprintIdHash) {
    reasons.push("fingerprint_id_changed");
  }
  if (existingCookie.fingerprintSource !== summary.fingerprintSource) {
    reasons.push("fingerprint_source_changed");
  }
  if (existingCookie.hashes.stableDeviceClusterKey !== summary.hashes.stableDeviceClusterKey) {
    reasons.push("stable_device_changed");
  }
  if (existingCookie.hashes.localeClusterKey !== summary.hashes.localeClusterKey) {
    reasons.push("locale_changed");
  }
  if (existingCookie.hashes.renderingHash !== summary.hashes.renderingHash) {
    reasons.push("rendering_changed");
  }
  if (existingCookie.requestSignals.userAgentHash !== summary.requestSignals.userAgentHash) {
    reasons.push("user_agent_changed");
  }
  if (
    existingCookie.requestSignals.acceptLanguageHash !== summary.requestSignals.acceptLanguageHash
  ) {
    reasons.push("accept_language_changed");
  }

  return {
    status: reasons.length > 0 ? "major" : "none",
    reasons,
  };
}

export function deriveTrustedFingerprintFromHints(
  hints: UnverifiedFingerprintHints,
  request: Request,
): ServerVerifiedFingerprintSummary {
  const environment = {
    language: normalizeString(hints.environment.language, 32),
    languages: normalizeStringArray(hints.environment.languages, 32),
    timezone: normalizeString(hints.environment.timezone, 64),
  };
  const display = {
    screenWidth: normalizeNumber(hints.display.screenWidth),
    screenHeight: normalizeNumber(hints.display.screenHeight),
    innerWidth: normalizeNumber(hints.display.innerWidth),
    innerHeight: normalizeNumber(hints.display.innerHeight),
    devicePixelRatio: normalizeNumber(hints.display.devicePixelRatio),
  };
  const hardware = {
    hardwareConcurrency: normalizeNumber(hints.hardware.hardwareConcurrency),
    deviceMemory: normalizeNumber(hints.hardware.deviceMemory),
    maxTouchPoints: normalizeNumber(hints.hardware.maxTouchPoints),
  };
  const rendering = {
    webGlVendor: normalizeString(hints.rendering.webGlVendor, 120),
    webGlRenderer: normalizeString(hints.rendering.webGlRenderer, 160),
  };
  const automation = {
    automationVerdict: hints.automation?.automationVerdict ?? "unverified_invalid_or_missing",
    automationConfidence: hints.automation?.automationConfidence ?? "unverified_invalid_or_missing",
    reasonCodes: normalizeStringArray(hints.automation?.reasonCodes, 48),
  };
  const fingerprintId = normalizeString(hints.fingerprintId, 128) || "unknown";
  const fingerprintIdHash = hashValue(fingerprintId);
  const clientFingerprintHeader = normalizeClientFingerprint(
    request.headers.get(CLIENT_FINGERPRINT_HEADER),
  );
  const requestSignals = {
    userAgentHash: hashValue(normalizeString(request.headers.get("user-agent") ?? "", 320)),
    acceptLanguageHash: hashValue(
      normalizeString(request.headers.get("accept-language") ?? "", 160),
    ),
  };

  const environmentHash = hashValue(JSON.stringify(environment));
  const displayHash = hashValue(JSON.stringify(display));
  const stableDisplayHash = hashValue(JSON.stringify(buildStableDisplay(display)));
  const renderingHash = hashValue(JSON.stringify(rendering));
  const localeClusterKey = hashValue(
    JSON.stringify({
      language: environment.language,
      languages: environment.languages,
    }),
  );
  const deviceClusterKey = hashValue(
    JSON.stringify({
      ...environment,
      ...display,
      ...hardware,
      rendering,
      requestSignals,
    }),
  );
  const stableDeviceClusterKey = hashValue(
    JSON.stringify({
      stableDisplay: buildStableDisplay(display),
      hardware,
      rendering,
      environment,
      requestSignals,
    }),
  );
  const profileHash = hashValue(
    JSON.stringify({
      fingerprintIdHash,
      fingerprintSource: hints.fingerprintSource,
      environmentHash,
      displayHash,
      stableDisplayHash,
      renderingHash,
      localeClusterKey,
      deviceClusterKey,
      stableDeviceClusterKey,
      automation,
    }),
  );
  const trustedFingerprint = `${TRUSTED_FINGERPRINT_PREFIX}${hashValue(
    JSON.stringify({
      fingerprintIdHash,
      fingerprintSource: hints.fingerprintSource,
      stableDeviceClusterKey,
      localeClusterKey,
      renderingHash,
      requestSignals,
    }),
  )}`;

  return {
    profileVersion: 1,
    fingerprintId,
    fingerprintSource: hints.fingerprintSource === "fingerprintjs" ? "fingerprintjs" : "fallback",
    collectedAt: normalizeNumber(hints.collectedAt) || Date.now(),
    environment,
    display,
    hardware,
    rendering,
    automation,
    hashes: {
      fingerprintIdHash,
      profileHash,
      environmentHash,
      displayHash,
      stableDisplayHash,
      renderingHash,
      deviceClusterKey,
      stableDeviceClusterKey,
      localeClusterKey,
    },
    trustedFingerprint,
    requestSignals,
    trust: {
      clientFingerprintHeader,
      claimedFingerprintIdMatchesHeader: clientFingerprintHeader === fingerprintId,
      existingCookieStatus: "absent",
      activeTrustedFingerprint: null,
      promotionEligible: false,
      promotionDecision: "missing_fingerprint_id",
      driftStatus: "none",
      driftReasons: [],
    },
  };
}

export function createTrustedFingerprintCookiePayload(
  summary: ServerVerifiedFingerprintSummary,
): TrustedFingerprintCookiePayload | null {
  if (
    summary.fingerprintSource !== "fingerprintjs" ||
    !summary.fingerprintId ||
    summary.fingerprintId === "unknown"
  ) {
    return null;
  }
  return buildTrustCookiePayload(summary);
}

export async function createTrustedFingerprintCookieValue(
  payload: TrustedFingerprintCookiePayload,
): Promise<string | null> {
  if (!payload.trustedFingerprint) return null;
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signingPayload = `${TOKEN_VERSION}.${encodedPayload}`;
  const signature = await signValue(signingPayload);
  if (!signature) return null;
  return `${signingPayload}.${signature}`;
}

export async function verifyTrustedFingerprintCookieValue(
  cookieValue: string | undefined,
): Promise<TrustedFingerprintCookiePayload | null> {
  if (!cookieValue) return null;
  const [version, encodedPayload, signature] = cookieValue.split(".");
  if (version !== TOKEN_VERSION || !encodedPayload || !signature) return null;
  const expected = await signValue(`${version}.${encodedPayload}`);
  if (!expected || !safeEquals(signature, expected)) return null;

  const decoded = base64UrlDecode(encodedPayload);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as TrustedFingerprintCookiePayload;
    if (
      parsed.tokenVersion !== TOKEN_VERSION ||
      parsed.fingerprintSource !== "fingerprintjs" ||
      !parsed.trustedFingerprint.startsWith(TRUSTED_FINGERPRINT_PREFIX) ||
      !parsed.hashes?.fingerprintIdHash ||
      !parsed.hashes?.stableDeviceClusterKey ||
      !parsed.hashes?.localeClusterKey ||
      !parsed.hashes?.renderingHash ||
      !parsed.requestSignals?.userAgentHash ||
      !parsed.requestSignals?.acceptLanguageHash
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function readTrustedFingerprintCookieFromRequest(
  request: Request,
): Promise<TrustedFingerprintCookiePayload | null> {
  return verifyTrustedFingerprintCookieValue(extractCookieValue(request, FINGERPRINT_COOKIE));
}

export async function resolveFingerprintTrust(
  request: Request,
  hints: UnverifiedFingerprintHints | undefined,
  options?: { allowPromotion?: boolean },
): Promise<ResolvedFingerprintTrust> {
  const existingCookie = await readTrustedFingerprintCookieFromRequest(request);
  if (!hints) {
    return {
      existingCookie,
      cookiePayloadToSet: null,
    };
  }

  const summary = deriveTrustedFingerprintFromHints(hints, request);
  summary.trust.existingCookieStatus = existingCookie ? "present" : "absent";

  const ineligible = classifyPromotionEligibility(summary);
  summary.trust.promotionEligible = !ineligible;

  if (existingCookie) {
    const drift = assessFingerprintDrift(existingCookie, summary);
    summary.trust.driftStatus = drift.status;
    summary.trust.driftReasons = drift.reasons;
    summary.trust.activeTrustedFingerprint = existingCookie.trustedFingerprint;
    if (drift.status === "major") {
      summary.trust.promotionDecision = "reused_existing_cookie_due_to_major_drift";
      return {
        summary,
        existingCookie,
        cookiePayloadToSet: null,
      };
    }
    summary.trust.promotionDecision = "reused_existing_cookie";
    return {
      summary,
      existingCookie,
      cookiePayloadToSet: null,
    };
  }

  if (ineligible) {
    summary.trust.promotionDecision = ineligible.decision;
    return {
      summary,
      existingCookie: null,
      cookiePayloadToSet: null,
    };
  }

  if (options?.allowPromotion === false) {
    summary.trust.promotionDecision = "route_does_not_mint";
    summary.trust.activeTrustedFingerprint = null;
    return {
      summary,
      existingCookie: null,
      cookiePayloadToSet: null,
    };
  }

  const cookiePayload = createTrustedFingerprintCookiePayload(summary);
  if (!cookiePayload) {
    summary.trust.promotionDecision = "missing_fingerprint_id";
    return {
      summary,
      existingCookie: null,
      cookiePayloadToSet: null,
    };
  }

  summary.trust.promotionDecision = "minted_new_cookie";
  summary.trust.activeTrustedFingerprint = cookiePayload.trustedFingerprint;
  return {
    summary,
    existingCookie: null,
    cookiePayloadToSet: cookiePayload,
  };
}

export async function applyTrustedFingerprintCookie(
  response: NextResponse,
  payload: TrustedFingerprintCookiePayload,
): Promise<void> {
  const value = await createTrustedFingerprintCookieValue(payload);
  if (!value) return;
  response.cookies.set(FINGERPRINT_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: FINGERPRINT_COOKIE_MAX_AGE,
  });
}

export function clearTrustedFingerprintCookie(response: NextResponse): void {
  response.cookies.set(FINGERPRINT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}
