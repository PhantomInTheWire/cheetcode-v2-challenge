import { describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/validate-batch/route";

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: vi.fn(async () => ({ ok: true, github: "tester" })),
}));

describe("/api/validate-batch", () => {
  it("validates multiple items independently in one batch", async () => {
    const req = new Request("http://localhost/api/validate-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            problemId: "p1",
            code: "(x) => x + 1",
            testCases: [{ input: { x: 1 }, args: [1], expected: 2 }],
          },
          {
            problemId: "p2",
            code: "(x) => x * 2",
            testCases: [{ input: { x: 3 }, args: [3], expected: 6 }],
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Record<string, { passed: boolean; error?: string }>;
    };
    expect(body.results.p1?.passed).toBe(true);
    expect(body.results.p2?.passed).toBe(true);
  });

  it("maps object input by parameter name when key order differs", async () => {
    const req = new Request("http://localhost/api/validate-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            problemId: "dragon-treasure-count",
            code: "function countTreasure(gold, silver, copper) { return gold * 10000 + silver * 100 + copper; }",
            testCases: [
              // Intentionally shuffled key order
              { input: { copper: 100, gold: 5, silver: 50 }, args: [5, 50, 100], expected: 55100 },
            ],
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Record<string, { passed: boolean; error?: string }>;
    };
    expect(body.results["dragon-treasure-count"]?.passed).toBe(true);
  });

  it("fails with timeout for non-terminating code", async () => {
    const req = new Request("http://localhost/api/validate-batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            problemId: "loop",
            code: "() => { while (true) {} }",
            testCases: [{ input: {}, args: [], expected: 0 }],
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: Record<string, { passed: boolean; error?: string }>;
    };
    expect(body.results.loop?.passed).toBe(false);
    expect(body.results.loop?.error).toContain("Time limit exceeded");
  });
});
