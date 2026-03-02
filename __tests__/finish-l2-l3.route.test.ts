import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  return {
    queryMock: vi.fn(),
    actionMock: vi.fn(),
    requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
    validateL3Mock: vi.fn(async () => ({
      compiled: true,
      error: "",
      results: [{ problemId: "c1", correct: true, message: "ok" }],
    })),
  };
});

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: hoisted.queryMock,
    action: hoisted.actionMock,
  })),
}));

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../server/level3/validation", () => ({
  validateLevel3Submission: hoisted.validateL3Mock,
}));

describe("finish l2/l3 routes", () => {
  beforeEach(() => {
    hoisted.queryMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.validateL3Mock.mockClear();
    hoisted.queryMock.mockResolvedValue({
      github: "tester",
      level: 3,
      startedAt: 1_000,
      expiresAt: 121_000,
      problemIds: ["cpu:task:lang:check1"],
    });
    hoisted.actionMock.mockResolvedValue({
      elo: 123,
      solved: 1,
      rank: 1,
      timeRemaining: 1,
    });
  });

  it("/api/finish-l2 records results for authorized owner", async () => {
    const { POST } = await import("../src/app/api/finish-l2/route");
    hoisted.queryMock.mockResolvedValueOnce({
      github: "tester",
      level: 2,
      startedAt: 1_000,
      expiresAt: 46_000,
      problemIds: ["l2_1"],
    });

    const req = new Request("http://localhost/api/finish-l2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s1",
        solvedProblemIds: ["l2_1"],
        timeElapsed: 3000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalled();
  });

  it("/api/finish-l3 validates and records solved checks", async () => {
    const { POST } = await import("../src/app/api/finish-l3/route");
    const req = new Request("http://localhost/api/finish-l3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s3",
        code: "int main(){return 0;}",
        timeElapsed: 5000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { validation: { compiled: boolean } };
    expect(body.validation.compiled).toBe(true);
    expect(hoisted.validateL3Mock).toHaveBeenCalled();
    expect(hoisted.actionMock).toHaveBeenCalled();
  });
});
