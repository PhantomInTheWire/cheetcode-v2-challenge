import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: vi.fn(async () => ({ ok: true, github: "tester" })),
}));

vi.mock("../server/level3/validation", () => ({
  validateLevel3Submission: vi.fn(async () => ({
    compiled: true,
    error: "",
    results: [{ problemId: "p1", correct: true, message: "ok" }],
  })),
}));

describe("validate l2/l3 routes", () => {
  it("/api/validate-l2 validates acceptable answers", async () => {
    const { POST } = await import("../src/app/api/validate-l2/route");
    const req = new Request("http://localhost/api/validate-l2", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: { l2_2: "zero" } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ problemId: string; correct: boolean }> };
    const item = body.results.find((r) => r.problemId === "l2_2");
    expect(item?.correct).toBe(true);
  });

  it("/api/validate-l3 returns validation payload for authenticated request", async () => {
    const { POST } = await import("../src/app/api/validate-l3/route");
    const req = new Request("http://localhost/api/validate-l3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ challengeId: "any", code: "int main(){return 0;}" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { compiled: boolean; results: Array<{ correct: boolean }> };
    expect(body.compiled).toBe(true);
    expect(body.results[0]?.correct).toBe(true);
  });
});
