import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  actionMock: vi.fn(async () => ({ ok: true, upserted: "created" })),
}));

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = hoisted.actionMock;
  },
}));

describe("/api/leads", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.actionMock.mockResolvedValue({ ok: true, upserted: "created" });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CONVEX_MUTATION_SECRET = "secret";
  });

  it("returns unauthorized response when auth fails", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { POST } = await import("../src/app/api/leads/route");
    const req = new Request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "x@y.com", sessionId: "s" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("submits lead payload through convex action", async () => {
    const { POST } = await import("../src/app/api/leads/route");
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
});
