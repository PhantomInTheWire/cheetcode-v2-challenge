import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  requireUnlockedLevelMock: vi.fn(async () => null),
  pickPairMock: vi.fn(() => ["firefox", "postgres"]),
}));

vi.mock("../../src/lib/auth/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../../server/level2/problems", () => ({
  pickLevel2ProjectPair: hoisted.pickPairMock,
}));

vi.mock("../../src/lib/session/level-access", () => ({
  requireUnlockedLevel: hoisted.requireUnlockedLevelMock,
}));

describe("/api/level-2/preview", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.requireUnlockedLevelMock.mockReset();
    hoisted.pickPairMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.requireUnlockedLevelMock.mockResolvedValue(null);
    hoisted.pickPairMock.mockReturnValue(["firefox", "postgres"]);
  });

  it("returns project pair and hashes for authenticated request", async () => {
    const { GET } = await import("../../src/app/api/level-2/preview/route");
    const res = await GET(new Request("http://localhost/api/level-2/preview"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projects: Array<{ key: string; label: string; commit: string }>;
    };
    expect(body.projects).toEqual([
      {
        key: "firefox",
        label: "Firefox",
        commit: "22d04b52b0",
      },
      {
        key: "postgres",
        label: "PostgreSQL",
        commit: "f1baed18b",
      },
    ]);
  });

  it("returns auth response when request is unauthorized", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    } as unknown as {
      ok: boolean;
      github: string;
    });

    const { GET } = await import("../../src/app/api/level-2/preview/route");
    const res = await GET(new Request("http://localhost/api/level-2/preview"));

    expect(res.status).toBe(401);
  });
});
