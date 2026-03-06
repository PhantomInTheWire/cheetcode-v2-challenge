import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLevel3ChallengeFromId } from "../server/level3/problems";
import { resetLevel3InflightLocksForTests } from "../src/lib/abuse/guard";

const l3Challenge = getLevel3ChallengeFromId("l3:cpu-16bit-emulator:c");
if (!l3Challenge) throw new Error("missing level 3 challenge fixture");
const L3_CHECK_IDS = l3Challenge.checks.map((check) => check.id);
const L3_CHECK_COUNT = L3_CHECK_IDS.length;

const hoisted = vi.hoisted(() => {
  return {
    queryMock: vi.fn(),
    actionMock: vi.fn(),
    requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
    validateL3Mock: vi.fn(),
    sanitizeL3Mock: vi.fn((result) => ({
      ...result,
      error: result.compiled ? "" : "redacted",
      results: (result.results ?? []).map((row: { problemId: string; correct: boolean }) => ({
        ...row,
        message: row.correct ? "pass" : "fail",
      })),
    })),
  };
});

vi.mock("convex/browser", () => ({
  ConvexHttpClient: vi.fn().mockImplementation(() => ({
    query: hoisted.queryMock,
    action: hoisted.actionMock,
  })),
}));

vi.mock("../src/lib/env-vars", () => ({
  ENV: {
    NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
    CONVEX_MUTATION_SECRET: "test-secret",
  },
}));

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../server/level3/validation", () => ({
  validateLevel3Submission: hoisted.validateL3Mock,
  sanitizeLevel3ValidationForClient: hoisted.sanitizeL3Mock,
}));

describe("finish l2/l3 routes", () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    resetLevel3InflightLocksForTests();
    dateNowSpy?.mockRestore();
    dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);
    hoisted.queryMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.validateL3Mock.mockClear();
    hoisted.sanitizeL3Mock.mockClear();
    hoisted.validateL3Mock.mockResolvedValue({
      compiled: true,
      error: "",
      results: L3_CHECK_IDS.map((id) => ({ problemId: id, correct: true, message: "ok" })),
    });
    hoisted.queryMock.mockResolvedValue({
      github: "tester",
      level: 3,
      startedAt: 1_000,
      expiresAt: 121_000,
      problemIds: L3_CHECK_IDS,
    });
    hoisted.actionMock.mockImplementation(async (_ref: unknown, args: { eventType?: string }) => {
      if (args?.eventType) return { ok: true };
      if ("extendMs" in (args ?? {})) return { expiresAt: 130_000 };
      return {
        elo: 123,
        solved: 1,
        rank: 1,
        timeRemaining: 1,
      };
    });
  });

  afterEach(() => {
    dateNowSpy?.mockRestore();
    dateNowSpy = null;
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
        answers: { l2_1: "kOperationAborted", l2_2: "wrong" },
        timeElapsed: 3000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);
    const actionCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { solvedProblemIds: string[] }
      | undefined;
    expect(actionCall?.solvedProblemIds).toEqual(["l2_1"]);
    const telemetryCall = hoisted.actionMock.mock.calls[1]?.[1] as
      | { eventType: string; status: string }
      | undefined;
    expect(telemetryCall?.eventType).toBe("finish_l2");
    expect(telemetryCall?.status).toBe("passed");
  });

  it("/api/finish-l2 rejects submissions after the expiry grace window", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(52_000);
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
        answers: { l2_1: "kOperationAborted" },
        timeElapsed: 60_000,
      }),
    });

    const res = await POST(req);
    nowSpy.mockRestore();
    expect(res.status).toBe(410);
    expect(hoisted.actionMock).not.toHaveBeenCalled();
  });

  it("/api/finish-l2 rejects non-level-2 sessions", async () => {
    const { POST } = await import("../src/app/api/finish-l2/route");
    hoisted.queryMock.mockResolvedValueOnce({
      github: "tester",
      level: 1,
      startedAt: 1_000,
      expiresAt: 61_000,
      problemIds: ["easy:two-sum"],
    });

    const req = new Request("http://localhost/api/finish-l2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s1",
        answers: { l2_1: "kOperationAborted" },
        timeElapsed: 3000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(hoisted.actionMock).not.toHaveBeenCalled();
  });

  it("/api/finish-l3 validates and records all solved checks for full L3 scoring input", async () => {
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
    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);

    const actionCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { solvedProblemIds: string[] }
      | undefined;
    expect(actionCall).toBeTruthy();
    expect(actionCall?.solvedProblemIds).toHaveLength(L3_CHECK_COUNT);
    expect(new Set(actionCall?.solvedProblemIds).size).toBe(L3_CHECK_COUNT);
    expect(actionCall?.solvedProblemIds).toEqual(L3_CHECK_IDS);
    const telemetryCall = hoisted.actionMock.mock.calls[1]?.[1] as
      | { eventType: string; status: string }
      | undefined;
    expect(telemetryCall?.eventType).toBe("finish_l3");
    expect(telemetryCall?.status).toBe("passed");
  });

  it("each individual L3 check affects scoring input", async () => {
    const { POST } = await import("../src/app/api/finish-l3/route");

    for (const missedId of L3_CHECK_IDS) {
      hoisted.actionMock.mockClear();
      hoisted.validateL3Mock.mockResolvedValueOnce({
        compiled: true,
        error: "",
        results: L3_CHECK_IDS.map((id: string) => ({
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
      expect(actionCall?.solvedProblemIds).toHaveLength(L3_CHECK_COUNT - 1);
      expect(actionCall?.solvedProblemIds.includes(missedId)).toBe(false);
      const telemetryCall = hoisted.actionMock.mock.calls[1]?.[1] as
        | { eventType: string; status: string }
        | undefined;
      expect(telemetryCall?.eventType).toBe("finish_l3");
      expect(telemetryCall?.status).toBe("partial");
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
    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);
    const telemetryCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { eventType: string; status: string }
      | undefined;
    expect(telemetryCall?.eventType).toBe("finish_l3");
    expect(telemetryCall?.status).toBe("shadow_banned");
    const extensionCall = hoisted.actionMock.mock.calls[1]?.[1] as
      | { extendMs: number }
      | undefined;
    expect(extensionCall?.extendMs).toBeTypeOf("number");
  });

  it("/api/finish-l3 redacts compile errors in response", async () => {
    hoisted.validateL3Mock.mockResolvedValueOnce({
      compiled: false,
      error: "secret harness details",
      results: L3_CHECK_IDS.map((id: string) => ({
        problemId: id,
        correct: false,
        message: "leak",
      })),
    });

    const { POST } = await import("../src/app/api/finish-l3/route");
    const req = new Request("http://localhost/api/finish-l3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s3",
        code: "broken",
        timeElapsed: 5000,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: string; expiresAt: number };
    expect(body.error).toBe("redacted");
    expect(body.expiresAt).toBe(130_000);
  });

  it("/api/finish-l3 rejects concurrent inflight submissions for the same identity", async () => {
    let resolveValidation: ((value: {
      compiled: boolean;
      error: string;
      results: Array<{ problemId: string; correct: boolean; message: string }>;
    }) => void) | null = null;
    hoisted.validateL3Mock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveValidation = resolve;
        }),
    );

    const { POST } = await import("../src/app/api/finish-l3/route");
    const body = JSON.stringify({
      sessionId: "s3",
      code: "int main(){return 0;}",
      timeElapsed: 5000,
    });
    const req1 = new Request("http://localhost/api/finish-l3", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ctf-fingerprint": "fp-a" },
      body,
    });
    const req2 = new Request("http://localhost/api/finish-l3", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ctf-fingerprint": "fp-a" },
      body,
    });

    const pending = POST(req1);
    await Promise.resolve();

    const conflict = await POST(req2);
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: "level3 submission already in flight",
    });

    resolveValidation?.({
      compiled: true,
      error: "",
      results: L3_CHECK_IDS.map((id) => ({ problemId: id, correct: true, message: "ok" })),
    });
    const first = await pending;
    expect(first.status).toBe(200);
  });
});
