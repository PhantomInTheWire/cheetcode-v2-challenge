import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const hoisted = vi.hoisted(() => ({
  checkAndTrackAbuseInKvMock: vi.fn(),
  isKvConfiguredMock: vi.fn(() => true),
}));

vi.mock("../../src/lib/abuse/config", () => ({
  API_ROUTE_TO_ABUSE_ROUTE: {
    "/api/session": "session",
    "/api/level-3/validate": "level-3-validate",
    "/api/session/replay": "session-replay",
  },
}));

vi.mock("../../src/lib/abuse/guard", () => ({
  SHADOW_BAN_HEADER: "x-ctf-shadow-banned",
}));

vi.mock("../../src/lib/abuse/identity", () => ({
  TRUSTED_FINGERPRINT_HEADER: "x-ctf-fingerprint",
}));

vi.mock("../../src/lib/abuse/kv", () => ({
  checkAndTrackAbuseInKv: hoisted.checkAndTrackAbuseInKvMock,
  isKvConfigured: hoisted.isKvConfiguredMock,
}));

describe("proxy fingerprint promotion", () => {
  beforeEach(() => {
    hoisted.checkAndTrackAbuseInKvMock.mockReset();
    hoisted.isKvConfiguredMock.mockReset();
    hoisted.isKvConfiguredMock.mockReturnValue(true);
    hoisted.checkAndTrackAbuseInKvMock.mockResolvedValue({
      limited: false,
      retryAfterSeconds: 0,
      shadowBanned: false,
    });
    process.env.CONVEX_MUTATION_SECRET = "secret";
  });

  it("does not trust raw client fingerprint headers", async () => {
    const captured = { fingerprint: "" };
    hoisted.checkAndTrackAbuseInKvMock.mockImplementation(async (request: Request) => {
      captured.fingerprint = request.headers.get("x-ctf-fingerprint") ?? "";
      return { limited: false, retryAfterSeconds: 0, shadowBanned: false };
    });

    const { proxy } = await import("../../proxy");
    const request = new NextRequest("https://example.com/api/level-3/validate", {
      method: "POST",
      headers: {
        "x-client-fingerprint": "fp-real-visitor-id",
      },
    });

    const response = await proxy(request);

    expect(captured.fingerprint).toBe("");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("uses the raw client fingerprint only for the first /api/session abuse bucket", async () => {
    const captured = { fingerprint: "" };
    hoisted.checkAndTrackAbuseInKvMock.mockImplementation(async (request: Request) => {
      captured.fingerprint = request.headers.get("x-ctf-fingerprint") ?? "";
      return { limited: false, retryAfterSeconds: 0, shadowBanned: false };
    });

    const { proxy } = await import("../../proxy");
    const request = new NextRequest("https://example.com/api/session", {
      method: "POST",
      headers: {
        "x-client-fingerprint": "fp-real-visitor-id",
      },
    });

    const response = await proxy(request);

    expect(captured.fingerprint).toBe("bootstrap:fp-real-visitor-id");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("accepts signed trusted fingerprint cookies", async () => {
    const {
      createTrustedFingerprintCookiePayload,
      createTrustedFingerprintCookieValue,
      deriveTrustedFingerprintFromHints,
    } = await import("../../src/lib/fingerprint/server-trust");
    const summary = deriveTrustedFingerprintFromHints(
      {
        profileVersion: 1,
        collectedAt: 1_710_000_000_000,
        fingerprintId: "fp-real-visitor-id",
        fingerprintSource: "fingerprintjs",
        environment: { language: "en-US", languages: ["en-US"], timezone: "UTC" },
        display: {
          screenWidth: 1440,
          screenHeight: 900,
          innerWidth: 1440,
          innerHeight: 820,
          devicePixelRatio: 2,
        },
        hardware: { hardwareConcurrency: 8, deviceMemory: 8, maxTouchPoints: 0 },
        rendering: { webGlVendor: "WebKit", webGlRenderer: "Apple GPU" },
        automation: {
          automationVerdict: "normal",
          automationConfidence: "low",
          reasonCodes: [],
        },
      },
      new Request("https://example.com/api/session", {
        headers: {
          "user-agent": "Vitest Browser",
          "accept-language": "en-US,en;q=0.9",
          "x-client-fingerprint": "fp-real-visitor-id",
        },
      }),
    );
    const cookiePayload = createTrustedFingerprintCookiePayload(summary);
    expect(cookiePayload).toBeTruthy();
    if (!cookiePayload) {
      throw new Error("expected trusted fingerprint cookie payload");
    }
    const cookieValue = await createTrustedFingerprintCookieValue(cookiePayload);
    const captured = { fingerprint: "" };
    hoisted.checkAndTrackAbuseInKvMock.mockImplementation(async (request: Request) => {
      captured.fingerprint = request.headers.get("x-ctf-fingerprint") ?? "";
      return { limited: false, retryAfterSeconds: 0, shadowBanned: false };
    });

    const { proxy } = await import("../../proxy");
    const request = new NextRequest("https://example.com/api/level-3/validate", {
      method: "POST",
      headers: {
        cookie: `ctf_fp=${cookieValue}`,
        "x-client-fingerprint": "fp-real-visitor-id",
      },
    });

    const response = await proxy(request);

    expect(captured.fingerprint).toBe(summary.trustedFingerprint);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("clears invalid fingerprint cookies on replay requests", async () => {
    const { proxy } = await import("../../proxy");
    const request = new NextRequest("https://example.com/api/session/replay", {
      method: "POST",
      headers: {
        cookie: "ctf_fp=not-a-valid-cookie",
      },
    });

    const response = await proxy(request);
    expect(response.headers.get("set-cookie")).toContain("ctf_fp=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("clears legacy v1 fingerprint cookies", async () => {
    const { proxy } = await import("../../proxy");
    const request = new NextRequest("https://example.com/api/session/replay", {
      method: "POST",
      headers: {
        cookie: "ctf_fp=v1.srvfp-legacy.deadbeef",
      },
    });

    const response = await proxy(request);
    expect(response.headers.get("set-cookie")).toContain("ctf_fp=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
