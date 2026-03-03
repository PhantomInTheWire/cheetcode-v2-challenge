import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../src/lib/session-auth", () => ({
  requireOwnedSession: hoisted.requireOwnedSessionMock,
}));

vi.mock("../src/lib/env-vars", () => ({
  ENV: {
    CONVEX_MUTATION_SECRET: "test-secret",
  },
}));

vi.mock("../server/level3/validation", () => ({
  validateLevel3Submission: hoisted.validateL3Mock,
  sanitizeLevel3ValidationForClient: hoisted.sanitizeL3Mock,
}));

describe("validate l2/l3 routes", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.requireOwnedSessionMock.mockReset();
    hoisted.validateL3Mock.mockClear();
    hoisted.sanitizeL3Mock.mockClear();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.requireOwnedSessionMock.mockResolvedValue({
      session: {
        github: "tester",
        level: 2,
        startedAt: 1_000,
        expiresAt: 61_000,
        problemIds: ["l2_2", "p1"],
      },
      convex: { action: hoisted.actionMock },
    });
  });

  it("/api/validate-l2 validates acceptable answers and records telemetry", async () => {
    const { POST } = await import("../src/app/api/validate-l2/route");
    const req = new Request("http://localhost/api/validate-l2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s2", answers: { l2_2: "zero" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ problemId: string; correct: boolean }> };
    const item = body.results.find((r) => r.problemId === "l2_2");
    expect(item?.correct).toBe(true);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(1);
    const telemetryCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { eventType: string; status: string }
      | undefined;
    expect(telemetryCall?.eventType).toBe("validate_l2");
    expect(telemetryCall?.status).toBe("partial");
  });

  it("/api/validate-l2 requires auth", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });
    const { POST } = await import("../src/app/api/validate-l2/route");
    const req = new Request("http://localhost/api/validate-l2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s2", answers: { l2_2: "zero" } }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("/api/validate-l3 returns validation payload and records telemetry", async () => {
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
    const { POST } = await import("../src/app/api/validate-l3/route");
    const req = new Request("http://localhost/api/validate-l3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s3", challengeId: "any", code: "int main(){return 0;}" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { compiled: boolean; results: Array<{ correct: boolean }> };
    expect(body.compiled).toBe(true);
    expect(body.results[0]?.correct).toBe(true);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(1);
    const telemetryCall = hoisted.actionMock.mock.calls[0]?.[1] as
      | { eventType: string; status: string }
      | undefined;
    expect(telemetryCall?.eventType).toBe("validate_l3");
    expect(telemetryCall?.status).toBe("passed");
  });

  it("/api/validate-l3 redacts compile errors from client response", async () => {
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
    hoisted.validateL3Mock.mockResolvedValueOnce({
      compiled: false,
      error: "secret harness details",
      results: [{ problemId: "p1", correct: false, message: "leak" }],
    });

    const { POST } = await import("../src/app/api/validate-l3/route");
    const req = new Request("http://localhost/api/validate-l3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s3", challengeId: "any", code: "bad" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { error: string; results: Array<{ message: string }> };
    expect(body.error).toBe("redacted");
    expect(body.results[0]?.message).toBe("fail");
  });
});
