import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROBLEM_BANK } from "../../server/level1/problems";

const assignedProblem = PROBLEM_BANK.find((problem) => problem.id === "space-oxygen-calculator");

if (!assignedProblem) {
  throw new Error("missing level 1 validation fixture");
}

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  requireOwnedSessionMock: vi.fn(),
  actionMock: vi.fn(),
}));

vi.mock("../../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../../src/lib/session/session-auth", () => ({
  requireOwnedSession: hoisted.requireOwnedSessionMock,
}));

vi.mock("../../src/lib/env-vars", () => ({
  ENV: {
    NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
    CONVEX_MUTATION_SECRET: "test-secret",
  },
}));

describe("/api/validate-l1", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.requireOwnedSessionMock.mockReset();
    hoisted.actionMock.mockReset();

    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.requireOwnedSessionMock.mockResolvedValue({
      session: {
        github: "tester",
        level: 1,
        startedAt: 1_000,
        expiresAt: 61_000,
        problemIds: [assignedProblem.id],
      },
      convex: { action: hoisted.actionMock },
    });
    hoisted.actionMock.mockResolvedValue({ ok: true });
  });

  it("passes valid code and records successful validation telemetry", async () => {
    const { POST } = await import("../../src/app/api/validate-l1/route");
    const req = new Request("http://localhost/api/validate-l1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s1",
        problemId: assignedProblem.id,
        code: assignedProblem.solution,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      sessionId: "s1",
      problemId: assignedProblem.id,
      expiresAt: 61_000,
      status: "passed",
      passCount: assignedProblem.testCases.length,
      failCount: 0,
      totalCount: assignedProblem.testCases.length,
      passed: true,
    });
    expect(hoisted.actionMock).toHaveBeenCalledTimes(1);
    expect(hoisted.actionMock.mock.calls[0]?.[1]).toMatchObject({
      sessionId: "s1",
      github: "tester",
      eventType: "validate_l1",
      status: "passed",
      passCount: assignedProblem.testCases.length,
      failCount: 0,
    });
  });

  it("returns failedCase output and the landmine note on wrong answers", async () => {
    const { POST } = await import("../../src/app/api/validate-l1/route");
    const req = new Request("http://localhost/api/validate-l1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s1",
        problemId: assignedProblem.id,
        code: "function calculateOxygen() { return 0; }",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      passed: boolean;
      failedCase?: { actual: unknown; expected: unknown };
      system_note?: string;
    };
    expect(body.passed).toBe(false);
    expect(body.failedCase).toMatchObject({
      expected: assignedProblem.testCases[0]?.expected,
      actual: 0,
    });
    expect(body.system_note).toContain("X-Agent-Token: firecrawl-validated");
    expect(hoisted.actionMock.mock.calls[0]?.[1]).toMatchObject({
      eventType: "validate_l1",
      status: "failed",
      errorType: "wrong_answer",
      failCount: 1,
    });
  });

  it("classifies runtime errors from the sandbox", async () => {
    const { POST } = await import("../../src/app/api/validate-l1/route");
    const req = new Request("http://localhost/api/validate-l1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "s1",
        problemId: assignedProblem.id,
        code: "function calculateOxygen() { throw new Error('boom'); }",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      passed: boolean;
      error?: string;
      failedCase?: { actual: unknown };
    };
    expect(body).toMatchObject({
      passed: false,
      error: "Runtime error",
      failedCase: {
        actual: "ERROR",
      },
    });
    expect(hoisted.actionMock.mock.calls[0]?.[1]).toMatchObject({
      eventType: "validate_l1",
      status: "failed",
      errorType: "runtime",
    });
  });
});
