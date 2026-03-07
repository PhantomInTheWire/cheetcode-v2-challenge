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

vi.mock("../../src/lib/auth/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../../src/lib/session/session-auth", () => ({
  requireOwnedSession: hoisted.requireOwnedSessionMock,
}));

vi.mock("../../server/level3/problems", () => ({
  getLevel3ChallengeFromId: hoisted.getLevel3ChallengeFromIdMock,
}));

describe("/api/session/restore", () => {
  function makeFingerprintHints() {
    return {
      profileVersion: 1,
      collectedAt: 1_710_000_000_000,
      fingerprintId: "fingerprint-1234",
      fingerprintSource: "fingerprintjs" as const,
      environment: {
        language: "en-US",
        languages: ["en-US", "en"],
        timezone: "UTC",
      },
      display: {
        screenWidth: 1440,
        screenHeight: 900,
        innerWidth: 1440,
        innerHeight: 820,
        devicePixelRatio: 2,
      },
      hardware: {
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 0,
      },
      rendering: {
        webGlVendor: "WebKit",
        webGlRenderer: "Apple GPU",
      },
      automation: {
        automationVerdict: "normal" as const,
        automationConfidence: "low" as const,
        reasonCodes: [],
      },
    };
  }

  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.requireOwnedSessionMock.mockReset();
    hoisted.queryMock.mockReset();
    hoisted.getLevel3ChallengeFromIdMock.mockReset();

    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.queryMock.mockResolvedValue({ elo: 9, solved: 2, rank: 3 });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CONVEX_MUTATION_SECRET = "secret";
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
    expect(res.headers.get("set-cookie")).toBeNull();
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

  it("mints a trusted fingerprint cookie on restore when no valid cookie exists", async () => {
    hoisted.requireOwnedSessionMock.mockResolvedValueOnce({
      session: {
        github: "tester",
        level: 1,
        startedAt: 1_000,
        expiresAt: 61_000,
        problemIds: [assignedProblem.id],
      },
      convex: { query: hoisted.queryMock },
    });

    const { POST } = await import("../../src/app/api/session/restore/route");
    const req = new Request("http://localhost/api/session/restore", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-client-fingerprint": "fingerprint-1234",
        "user-agent": "Vitest Browser",
        "accept-language": "en-US,en;q=0.9",
      },
      body: JSON.stringify({
        sessionId: "s1",
        fingerprintHints: makeFingerprintHints(),
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("ctf_fp=v2.");
  });
});
