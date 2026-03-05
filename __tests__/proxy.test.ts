import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const hoisted = vi.hoisted(() => ({
  checkAndTrackAbuseInKvMock: vi.fn(),
  checkAndTrackAbuseMock: vi.fn(),
}));

vi.mock("../src/lib/abuse", () => ({
  API_ROUTE_TO_ABUSE_ROUTE: {
    "/api/session": "session",
    "/api/validate-l3": "validate-l3",
  },
  SHADOW_BAN_HEADER: "x-ctf-shadow-banned",
  TRUSTED_FINGERPRINT_HEADER: "x-ctf-fingerprint",
  checkAndTrackAbuseInKv: hoisted.checkAndTrackAbuseInKvMock,
  checkAndTrackAbuse: hoisted.checkAndTrackAbuseMock,
}));

describe("proxy fingerprint promotion", () => {
  beforeEach(() => {
    hoisted.checkAndTrackAbuseInKvMock.mockReset();
    hoisted.checkAndTrackAbuseMock.mockReset();
    hoisted.checkAndTrackAbuseInKvMock.mockResolvedValue(null);
    hoisted.checkAndTrackAbuseMock.mockReturnValue({
      limited: false,
      retryAfterSeconds: 0,
      shadowBanned: false,
    });
  });

  it("upgrades a fallback cookie to the real client fingerprint", async () => {
    const captured = { fingerprint: "" };
    hoisted.checkAndTrackAbuseMock.mockImplementation((request: Request) => {
      captured.fingerprint = request.headers.get("x-ctf-fingerprint") ?? "";
      return { limited: false, retryAfterSeconds: 0, shadowBanned: false };
    });

    const { proxy } = await import("../proxy");
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
});
