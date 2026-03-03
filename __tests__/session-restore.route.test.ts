import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  queryMock: vi.fn(),
}));

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = hoisted.queryMock;
  },
}));

describe("/api/session/restore", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.queryMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  });

  it("returns unauthorized response when auth fails", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { POST } = await import("../src/app/api/session/restore/route");
    const res = await POST(new Request("http://localhost/api/session/restore", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("requires sessionId in request body", async () => {
    const { POST } = await import("../src/app/api/session/restore/route");
    const req = new Request("http://localhost/api/session/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
