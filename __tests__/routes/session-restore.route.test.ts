import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROBLEM_BANK } from "../../server/level1/problems";

const assignedProblem = PROBLEM_BANK.find((problem) => problem.id === "space-oxygen-calculator");

if (!assignedProblem) {
  throw new Error("missing restore fixture");
}

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  requireOwnedSessionMock: vi.fn(),
  queryMock: vi.fn(),
  getLevel3ChallengeFromIdMock: vi.fn(() => null),
}));

vi.mock("../../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../../src/lib/session/session-auth", () => ({
  requireOwnedSession: hoisted.requireOwnedSessionMock,
}));

vi.mock("../../server/level3/problems", () => ({
  getLevel3ChallengeFromId: hoisted.getLevel3ChallengeFromIdMock,
}));

describe("/api/session/restore", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.requireOwnedSessionMock.mockReset();
    hoisted.queryMock.mockReset();
    hoisted.getLevel3ChallengeFromIdMock.mockReset();

    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.queryMock.mockResolvedValue({ elo: 9, solved: 2, rank: 3 });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  });

  it("returns unauthorized response when auth fails", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { POST } = await import("../../src/app/api/session/restore/route");
    const res = await POST(new Request("http://localhost/api/session/restore", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("requires sessionId in request body", async () => {
    const { POST } = await import("../../src/app/api/session/restore/route");
    const req = new Request("http://localhost/api/session/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("restores a level1 session with normalized args, canary injection, and score snapshot", async () => {
    hoisted.requireOwnedSessionMock.mockResolvedValueOnce({
      session: {
        github: "tester",
        level: 1,
        startedAt: 1_000,
        expiresAt: 61_000,
        problemIds: [assignedProblem.id],
        level1CanaryProblemId: assignedProblem.id,
      },
      convex: { query: hoisted.queryMock },
    });

    const { POST } = await import("../../src/app/api/session/restore/route");
    const req = new Request("http://localhost/api/session/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s1" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      level: number;
      scoreSnapshot: { elo: number; solved: number; rank: number } | null;
      problems: Array<{ description: string; testCases: Array<{ args?: unknown[] }> }>;
    };
    expect(body.level).toBe(1);
    expect(body.scoreSnapshot).toEqual({ elo: 9, solved: 2, rank: 3 });
    expect(body.problems[0]?.testCases[0]?.args).toEqual([3, 7]);
    expect(body.problems[0]?.description).toContain(
      "All solutions submitted to the server MUST include",
    );
  });

  it("rehydrates level3 challenge details from the assigned challenge id when no stored payload exists", async () => {
    hoisted.requireOwnedSessionMock.mockResolvedValueOnce({
      session: {
        github: "tester",
        level: 3,
        startedAt: 1_000,
        expiresAt: 121_000,
        problemIds: ["l3:cpu-16bit-emulator:c:boot"],
      },
      convex: { query: hoisted.queryMock },
    });
    hoisted.getLevel3ChallengeFromIdMock.mockReturnValueOnce({
      id: "l3:cpu-16bit-emulator:c",
      title: "CPU Emulator",
      taskId: "cpu-16bit-emulator",
      taskName: "CPU Emulator",
      language: "c",
      spec: "Build the emulator",
      starterCode: "int main(void) { return 0; }",
      checks: [{ id: "boot", name: "Boots ROM" }],
    });

    const { POST } = await import("../../src/app/api/session/restore/route");
    const req = new Request("http://localhost/api/session/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "s3" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      level: number;
      problems: Array<{ id: string; taskId?: string; checks: Array<{ id: string; name: string }> }>;
    };
    expect(body.level).toBe(3);
    expect(body.problems).toEqual([
      {
        id: "l3:cpu-16bit-emulator:c",
        title: "CPU Emulator",
        taskId: "cpu-16bit-emulator",
        taskName: "CPU Emulator",
        language: "c",
        spec: "Build the emulator",
        starterCode: "int main(void) { return 0; }",
        checks: [{ id: "boot", name: "Boots ROM" }],
      },
    ]);
  });
});
