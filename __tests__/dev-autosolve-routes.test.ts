import { describe, expect, it, vi } from "vitest";
import { PROBLEM_BANK } from "../server/level1/problems";
import { LEVEL2_PROBLEMS } from "../server/level2/problems";

vi.mock("../src/lib/myEnv", () => ({
  isServerDevMode: vi.fn(() => true),
}));
vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: vi.fn(async () => ({ ok: true, github: "tester" })),
}));
vi.mock("../server/level3/problems", () => ({
  getLevel3ChallengeFromId: vi.fn((id: string) =>
    id === "ok" ? { id: "ok", language: "C" } : null,
  ),
}));
vi.mock("../server/level3/autoSolve", () => ({
  getLevel3AutoSolveCode: vi.fn(() => "int main(){return 0;}"),
}));

describe("dev auto-solve routes", () => {
  it("/api/dev/auto-solve-l1 returns solutions for requested level1 IDs", async () => {
    const { POST } = await import("../src/app/api/dev/auto-solve-l1/route");
    const first = PROBLEM_BANK[0];
    expect(first).toBeTruthy();

    const req = new Request("http://localhost/api/dev/auto-solve-l1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ problemIds: [first.id] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { solutions: Record<string, string> };
    expect(body.solutions[first.id]).toBe(first.solution);
  });

  it("/api/dev/auto-solve-l2 returns answers for requested level2 IDs", async () => {
    const { POST } = await import("../src/app/api/dev/auto-solve-l2/route");
    const first = LEVEL2_PROBLEMS[0];
    expect(first).toBeTruthy();

    const req = new Request("http://localhost/api/dev/auto-solve-l2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ problemIds: [first.id] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { answers: Record<string, string> };
    expect(body.answers[first.id]).toBe(first.answer);
  });

  it("/api/dev/auto-solve-l3 returns language solution code for known challenge", async () => {
    const { POST } = await import("../src/app/api/dev/auto-solve-l3/route");
    const req = new Request("http://localhost/api/dev/auto-solve-l3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: "ok" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { code: string };
    expect(body.code).toContain("main");
  });
});
