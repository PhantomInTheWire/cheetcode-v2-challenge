import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const hoisted = vi.hoisted(() => ({
  checkAndTrackAbuseInKvMock: vi.fn(),
  isKvConfiguredMock: vi.fn(() => true),
}));

vi.mock("../../src/lib/abuse/config", () => ({
  API_ROUTE_TO_ABUSE_ROUTE: {
    "/api/session": "session",
    "/api/validate-l3": "validate-l3",
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
  });

  it("upgrades a fallback cookie to the real client fingerprint", async () => {
    const captured = { fingerprint: "" };
    hoisted.checkAndTrackAbuseInKvMock.mockImplementation(async (request: Request) => {
      captured.fingerprint = request.headers.get("x-ctf-fingerprint") ?? "";
      return { limited: false, retryAfterSeconds: 0, shadowBanned: false };
    });

    const { proxy } = await import("../../proxy");
    const request = new NextRequest("https://example.com/api/validate-l3", {
      method: "POST",
      headers: {
        cookie: "ctf_fp=fallback-old-fingerprint",
        "x-client-fingerprint": "fp-real-visitor-id",
      },
    });

    const response = await proxy(request);

    expect(captured.fingerprint).toBe("fp-real-visitor-id");
    expect(response.headers.get("set-cookie")).toContain("ctf_fp=fp-real-visitor-id");
  });

  it("promotes trusted fingerprint headers for replay requests even without abuse checks", async () => {
    const { proxy } = await import("../../proxy");
    const request = new NextRequest("https://example.com/api/session/replay", {
      method: "POST",
      headers: {
        "x-client-fingerprint": "fp-replay-visitor-id",
      },
    });

    const response = await proxy(request);
    expect(response.headers.get("set-cookie")).toContain("ctf_fp=fp-replay-visitor-id");
  });
});
