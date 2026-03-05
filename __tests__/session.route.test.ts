import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  actionMock: vi.fn(async () => ({
    level: 1,
    problems: [
      {
        id: "p1",
        title: "T",
        tier: "easy",
        description: "D",
        signature: "solve(a, b)",
        starterCode: "",
        testCases: [{ input: { a: 1, b: 2 }, expected: 3 }],
      },
    ],
  })),
  getLevel3ChallengeFromIdMock: vi.fn(() => null),
}));

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = hoisted.actionMock;
  },
}));

vi.mock("../server/level3/problems", () => ({
  getLevel3ChallengeFromId: hoisted.getLevel3ChallengeFromIdMock,
}));

describe("/api/session", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.getLevel3ChallengeFromIdMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.actionMock.mockResolvedValue({
      level: 1,
      problems: [
        {
          id: "p1",
          title: "T",
          tier: "easy",
          description: "D",
          signature: "solve(a, b)",
          starterCode: "",
          testCases: [{ input: { a: 1, b: 2 }, expected: 3 }],
        },
      ],
    });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CONVEX_MUTATION_SECRET = "secret";
  });

  it("returns unauthorized response when auth fails", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { POST } = await import("../src/app/api/session/route");
    const res = await POST(new Request("http://localhost/api/session", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("normalizes level1 test cases with args", async () => {
    hoisted.actionMock.mockResolvedValueOnce({
      level: 1,
      problems: [
        {
          id: "p1",
          title: "T",
          tier: "easy",
          description: "D",
          signature: "solve(a, b)",
          starterCode: "",
          testCases: [{ input: { a: 1, b: 2 }, expected: 3 }],
        },
      ],
    });

    const { POST } = await import("../src/app/api/session/route");
    const req = new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      level: number;
      problems: Array<{ testCases: Array<{ args?: unknown[] }> }>;
    };
    expect(body.level).toBe(1);
    expect(body.problems[0]?.testCases[0]?.args).toEqual([1, 2]);
  });
});
