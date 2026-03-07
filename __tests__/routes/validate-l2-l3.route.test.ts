import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLevel3InflightLocksForTests } from "../../src/lib/abuse/guard";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  actionMock: vi.fn(),
  requireOwnedSessionMock: vi.fn(),
  validateL3Mock: vi.fn(async () => ({
    compiled: true,
    error: "",
    results: [{ problemId: "p1", correct: true, message: "ok" }],
  })),
  sanitizeL3Mock: vi.fn((result) => ({
    ...result,
    error: result.compiled ? "" : "redacted",
    results: (result.results ?? []).map((row: { problemId: string; correct: boolean }) => ({
      ...row,
      message: row.correct ? "pass" : "fail",
    })),
  })),
}));

vi.mock("../../src/lib/auth/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../../src/lib/session/session-auth", () => ({
  requireOwnedSession: hoisted.requireOwnedSessionMock,
}));

vi.mock("../../src/lib/config/env", () => ({
  ENV: {
    CONVEX_MUTATION_SECRET: "test-secret",
  },
}));

vi.mock("../../server/level3/validation", () => ({
  validateLevel3Submission: hoisted.validateL3Mock,
  sanitizeLevel3ValidationForClient: hoisted.sanitizeL3Mock,
}));

describe("validate l2/l3 routes", () => {
  beforeEach(() => {
    resetLevel3InflightLocksForTests();
    hoisted.requireAuthMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.requireOwnedSessionMock.mockReset();
    hoisted.validateL3Mock.mockClear();
    hoisted.sanitizeL3Mock.mockClear();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.actionMock.mockImplementation(async (_ref: unknown, args: { eventType?: string }) => {
      if (args?.eventType) return { ok: true };
      return { expiresAt: 123_456 };
    });
    hoisted.requireOwnedSessionMock.mockResolvedValue({
      session: {
        github: "tester",
        level: 2,
        startedAt: 1_000,
        expiresAt: 61_000,
        problemIds: ["l2_2", "l2_1"],
      },
      convex: { action: hoisted.actionMock },
    });
  });

  it("/api/level-2/validate validates acceptable answers and records telemetry", async () => {
    const { POST } = await import("../../src/app/api/level-2/validate/route");
    const req = new Request("http://localhost/api/level-2/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s2", answers: { l2_2: "zero" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ problemId: string; correct: boolean }> };
    const item = body.results.find((r) => r.problemId === "l2_2");
    expect(item?.correct).toBe(true);
    expect(body.results.some((r) => r.problemId === "l2_3")).toBe(false);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(1);
    const telemetryCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { eventType: string; status: string }
      | undefined;
    expect(telemetryCall?.eventType).toBe("validate_l2");
    expect(telemetryCall?.status).toBe("partial");
  });

  it("/api/level-3/validate returns validation payload and records telemetry", async () => {
    hoisted.requireOwnedSessionMock.mockResolvedValueOnce({
      session: {
        github: "tester",
        level: 3,
        startedAt: 1_000,
        expiresAt: 121_000,
        problemIds: ["p1"],
      },
      convex: { action: hoisted.actionMock },
    });
    const { POST } = await import("../../src/app/api/level-3/validate/route");
    const req = new Request("http://localhost/api/level-3/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s3", challengeId: "p1", code: "int main(){return 0;}" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      compiled: boolean;
      expiresAt: number;
      results: Array<{ correct: boolean }>;
    };
    expect(body.compiled).toBe(true);
    expect(body.expiresAt).toBeGreaterThan(0);
    expect(body.results[0]?.correct).toBe(true);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(1);
    const telemetryCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { eventType: string; status: string }
      | undefined;
    expect(telemetryCall?.eventType).toBe("validate_l3");
    expect(telemetryCall?.status).toBe("passed");
  });

  it("/api/level-3/validate rejects challenge ids that do not match the session", async () => {
    hoisted.requireOwnedSessionMock.mockResolvedValueOnce({
      session: {
        github: "tester",
        level: 3,
        startedAt: 1_000,
        expiresAt: 121_000,
        problemIds: ["assigned:rust:check-1"],
      },
      convex: { action: hoisted.actionMock },
    });

    const { POST } = await import("../../src/app/api/level-3/validate/route");
    const req = new Request("http://localhost/api/level-3/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s3",
        challengeId: "other:rust:check-1",
        code: "int main(){return 0;}",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(hoisted.validateL3Mock).not.toHaveBeenCalled();
  });

  it("/api/level-3/validate rejects concurrent inflight submissions for the same identity", async () => {
    hoisted.requireOwnedSessionMock.mockResolvedValue({
      session: {
        github: "tester",
        level: 3,
        startedAt: 1_000,
        expiresAt: 121_000,
        problemIds: ["p1"],
      },
      convex: { action: hoisted.actionMock },
    });
    let resolveValidation:
      | ((value: {
          compiled: boolean;
          error: string;
          results: Array<{ problemId: string; correct: boolean; message: string }>;
        }) => void)
      | null = null;
    hoisted.validateL3Mock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveValidation = resolve;
        }),
    );

    const { POST } = await import("../../src/app/api/level-3/validate/route");
    const body = JSON.stringify({
      sessionId: "s3",
      challengeId: "p1",
      code: "int main(){return 0;}",
    });
    const req1 = new Request("http://localhost/api/level-3/validate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ctf-fingerprint": "fp-a" },
      body,
    });
    const req2 = new Request("http://localhost/api/level-3/validate", {
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
      results: [{ problemId: "p1", correct: true, message: "ok" }],
    });
    const first = await pending;
    expect(first.status).toBe(200);
  });
});
