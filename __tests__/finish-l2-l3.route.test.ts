import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  const l3CheckIds = Array.from({ length: 20 }, (_, i) => `l3:cpu-16bit-emulator:c:check_${i + 1}`);
  return {
    queryMock: vi.fn(),
    actionMock: vi.fn(),
    requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
    l3CheckIds,
    validateL3Mock: vi.fn(async () => ({
      compiled: true,
      error: "",
      results: l3CheckIds.map((id) => ({ problemId: id, correct: true, message: "ok" })),
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
      problemIds: hoisted.l3CheckIds,
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

  it("/api/finish-l3 validates and records all 20 solved checks for full L3 scoring input", async () => {
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

    const actionCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { solvedProblemIds: string[] }
      | undefined;
    expect(actionCall).toBeTruthy();
    expect(actionCall?.solvedProblemIds).toHaveLength(20);
    expect(new Set(actionCall?.solvedProblemIds).size).toBe(20);
    expect(actionCall?.solvedProblemIds).toEqual(hoisted.l3CheckIds);
  });

  it("each individual L3 check affects scoring input (20/20 sensitivity)", async () => {
    const { POST } = await import("../src/app/api/finish-l3/route");

    for (const missedId of hoisted.l3CheckIds) {
      hoisted.actionMock.mockClear();
      hoisted.validateL3Mock.mockResolvedValueOnce({
        compiled: true,
        error: "",
        results: hoisted.l3CheckIds.map((id: string) => ({
          problemId: id,
          correct: id !== missedId,
          message: id !== missedId ? "ok" : "fail",
        })),
      });

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

      const actionCall = hoisted.actionMock.mock.calls[0]?.[1] as
        | { solvedProblemIds: string[] }
        | undefined;
      expect(actionCall).toBeTruthy();
      expect(actionCall?.solvedProblemIds).toHaveLength(19);
      expect(actionCall?.solvedProblemIds.includes(missedId)).toBe(false);
    }
  });

  it("/api/finish-l3 short-circuits when shadow banned", async () => {
    const { POST } = await import("../src/app/api/finish-l3/route");
    const req = new Request("http://localhost/api/finish-l3", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ctf-shadow-banned": "1",
      },
      body: JSON.stringify({
        sessionId: "s3",
        code: "int main(){return 0;}",
        timeElapsed: 5000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rank: number };
    expect(body.rank).toBe(9999);
    expect(hoisted.validateL3Mock).not.toHaveBeenCalled();
    expect(hoisted.actionMock).not.toHaveBeenCalled();
  });
});
