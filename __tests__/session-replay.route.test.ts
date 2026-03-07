import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  queryMock: vi.fn(),
  actionMock: vi.fn(async () => "evt_1"),
}));

vi.mock("../src/lib/request-auth", () => ({
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

    const { POST } = await import("../src/app/api/session/replay/route");
    const res = await POST(new Request("http://localhost/api/session/replay", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("requires a valid replay payload", async () => {
    const { POST } = await import("../src/app/api/session/replay/route");
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
    const { POST } = await import("../src/app/api/session/replay/route");
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
    const { POST } = await import("../src/app/api/session/replay/route");
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

    const { POST } = await import("../src/app/api/session/replay/route");
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

    const { POST } = await import("../src/app/api/session/replay/route");
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
});
