import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROBLEM_BANK } from "../../server/level1/problems";
import { SANDBOX_FLAG } from "../../src/lib/quickjs-shared";

const assignedProblem = PROBLEM_BANK.find((problem) => problem.id === "space-oxygen-calculator");
const extraProblem = PROBLEM_BANK.find((problem) => problem.id !== "space-oxygen-calculator");

if (!assignedProblem || !extraProblem) {
  throw new Error("missing level 1 problem fixtures");
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

describe("/api/finish-l1", () => {
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
    hoisted.actionMock.mockImplementation(async (_ref: unknown, args: { eventType?: string }) => {
      if (args?.eventType) {
        return { ok: true };
      }
      return {
        elo: 321,
        solved: 1,
        rank: 7,
        timeRemaining: 42,
      };
    });
  });

  it("scores assigned submissions with real QuickJS evaluation and applies exploit or landmine modifiers", async () => {
    const { POST } = await import("../../src/app/api/finish-l1/route");
    const req = new Request("http://localhost/api/finish-l1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-firecrawl-hack": "true",
        "x-agent-token": "firecrawl-validated",
      },
      body: JSON.stringify({
        sessionId: "s1",
        submissions: [
          {
            problemId: assignedProblem.id,
            code: `// @ai-generated\n${assignedProblem.solution}`,
          },
          {
            problemId: extraProblem.id,
            code: extraProblem.solution,
          },
        ],
        timeElapsed: -50,
        flag: SANDBOX_FLAG,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      completedLevel: boolean;
      exploits: Array<{ id: string }>;
      landmines: Array<{ id: string }>;
    };
    expect(body.completedLevel).toBe(true);
    expect(body.exploits.map((item) => item.id)).toEqual(
      expect.arrayContaining(["time_traveler", "flag_finder", "header_hack", "problem_hoarder"]),
    );
    expect(body.landmines.map((item) => item.id)).toEqual(
      expect.arrayContaining(["canary_comment", "injection_echo"]),
    );

    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);
    expect(hoisted.actionMock.mock.calls[0]?.[1]).toMatchObject({
      sessionId: "s1",
      github: "tester",
      solvedProblemIds: [assignedProblem.id],
      timeElapsedMs: 0,
      exploitBonus: 100,
    });
    expect(hoisted.actionMock.mock.calls[1]?.[1]).toMatchObject({
      eventType: "finish_l1",
      status: "passed",
      solvedCount: 1,
      passCount: 1,
      failCount: 0,
    });
  });

  it("returns a shadow-ban response without recording results", async () => {
    const { POST } = await import("../../src/app/api/finish-l1/route");
    const req = new Request("http://localhost/api/finish-l1", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ctf-shadow-banned": "1",
        "x-firecrawl-hack": "true",
      },
      body: JSON.stringify({
        sessionId: "s1",
        submissions: [{ problemId: assignedProblem.id, code: assignedProblem.solution }],
        timeElapsed: 1_500,
        flag: SANDBOX_FLAG,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      elo: number;
      solved: number;
      rank: number;
      exploits: Array<{ id: string }>;
    };
    expect(body).toMatchObject({
      elo: 0,
      solved: 0,
      rank: 9999,
    });
    expect(body.exploits.map((item) => item.id)).toEqual(
      expect.arrayContaining(["flag_finder", "header_hack"]),
    );

    expect(hoisted.actionMock).toHaveBeenCalledTimes(1);
    expect(hoisted.actionMock.mock.calls[0]?.[1]).toMatchObject({
      eventType: "finish_l1",
      status: "shadow_banned",
      solvedCount: 1,
    });
  });
});
