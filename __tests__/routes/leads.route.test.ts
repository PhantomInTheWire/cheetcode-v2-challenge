import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  queryMock: vi.fn(async () => ({
    github: "tester",
    problemIds: [],
    startedAt: 1,
    expiresAt: Date.now() + 60_000,
    level: 1,
  })),
  actionMock: vi.fn(async () => ({ ok: true, upserted: "created" })),
}));

vi.mock("../../src/lib/auth/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = hoisted.queryMock;
    action = hoisted.actionMock;
  },
}));

describe("/api/leads", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.queryMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.queryMock.mockResolvedValue({
      github: "tester",
      problemIds: [],
      startedAt: 1,
      expiresAt: Date.now() + 60_000,
      level: 1,
    });
    hoisted.actionMock.mockResolvedValue({ ok: true, upserted: "created" });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CONVEX_MUTATION_SECRET = "secret";
  });

  it("returns unauthorized response when auth fails", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { POST } = await import("../../src/app/api/leads/route");
    const req = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@y.com", sessionId: "s" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("submits lead payload through convex action", async () => {
    const { POST } = await import("../../src/app/api/leads/route");
    const req = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@y.com", xHandle: "x", flag: "f", sessionId: "abc" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(1);
    const body = (await res.json()) as { ok: boolean; upserted: string };
    expect(body.ok).toBe(true);
  });

  it("returns 500 when Convex env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_CONVEX_URL;

    const { POST } = await import("../../src/app/api/leads/route");
    const req = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@y.com", sessionId: "abc" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(hoisted.actionMock).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({ error: "Lead submission failed" });
  });
});
