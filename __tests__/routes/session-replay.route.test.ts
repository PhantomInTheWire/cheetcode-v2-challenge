import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  queryMock: vi.fn(),
  actionMock: vi.fn(async () => "evt_1"),
}));

vi.mock("../../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = hoisted.queryMock;
    action = hoisted.actionMock;
  },
}));

describe("/api/session/replay", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.queryMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.queryMock.mockResolvedValue({
      github: "tester",
      level: 1,
      expiresAt: Date.now() + 60_000,
    });
    hoisted.actionMock.mockResolvedValue("evt_1");
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CONVEX_MUTATION_SECRET = "secret";
  });

  it("returns unauthorized response when auth fails", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { POST } = await import("../../src/app/api/session/replay/route");
    const res = await POST(new Request("http://localhost/api/session/replay", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("requires a valid replay payload", async () => {
    const { POST } = await import("../../src/app/api/session/replay/route");
    const res = await POST(
      new Request("http://localhost/api/session/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "s" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("records replay events for owned sessions", async () => {
    const { POST } = await import("../../src/app/api/session/replay/route");
    const res = await POST(
      new Request("http://localhost/api/session/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "s",
          eventType: "state_snapshot",
          screen: "playing",
          summary: { level: 1 },
          snapshot: { codes: { a: "return 1;" } },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);
  });

  it("ignores client-provided level values and records the stored session level", async () => {
    const { POST } = await import("../../src/app/api/session/replay/route");
    const res = await POST(
      new Request("http://localhost/api/session/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "s",
          level: 3,
          eventType: "state_snapshot",
          screen: "playing",
          summary: { level: 3 },
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);
    for (const call of hoisted.actionMock.mock.calls) {
      expect(call[1]).toMatchObject({ level: 1 });
    }
  });

  it("rejects replay events for expired sessions", async () => {
    hoisted.queryMock.mockResolvedValueOnce({
      github: "tester",
      level: 1,
      expiresAt: Date.now() - 6_000,
    });

    const { POST } = await import("../../src/app/api/session/replay/route");
    const res = await POST(
      new Request("http://localhost/api/session/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "s",
          eventType: "heartbeat",
          screen: "playing",
        }),
      }),
    );

    expect(res.status).toBe(410);
    expect(hoisted.actionMock).not.toHaveBeenCalled();
  });

  it("accepts replay events during the finish-route grace window", async () => {
    hoisted.queryMock.mockResolvedValueOnce({
      github: "tester",
      level: 1,
      expiresAt: Date.now() - 2_000,
    });

    const { POST } = await import("../../src/app/api/session/replay/route");
    const res = await POST(
      new Request("http://localhost/api/session/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "s",
          eventType: "session_completed",
          screen: "playing",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);
  });

  it("stores client fingerprint payloads as unverified hints only", async () => {
    const { POST } = await import("../../src/app/api/session/replay/route");
    const res = await POST(
      new Request("http://localhost/api/session/replay", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.40",
          "x-ctf-fingerprint": "fp-trusted-replay-header",
        },
        body: JSON.stringify({
          sessionId: "s",
          eventType: "state_snapshot",
          screen: "playing",
          summary: {
            fingerprint: {
              fingerprintId: "fingerprint-1234",
              fingerprintSource: "fingerprintjs",
              automation: {
                automationVerdict: "normal",
                automationConfidence: "high",
                reasonCodes: ["claimed_normal"],
              },
              hashes: {
                profileHash: "forged-profile-hash",
                deviceClusterKey: "forged-device-key",
              },
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
            },
          },
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(3);
    expect(hoisted.actionMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        identities: [
          expect.objectContaining({ kind: "ip" }),
          expect.objectContaining({ kind: "fp" }),
        ],
      }),
    );
    expect(hoisted.actionMock.mock.calls[2]?.[1]).toMatchObject({
      sourceTrust: "client_unverified",
    });
    expect(
      JSON.parse(String(hoisted.actionMock.mock.calls[2]?.[1]?.summaryJson)),
    ).not.toHaveProperty("hashes");
  });
});
