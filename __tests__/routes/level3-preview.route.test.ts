import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  generateMetaMock: vi.fn(() => ({
    id: "l3:cpu-16bit-emulator:rust",
    taskName: "16-bit CPU Emulator",
    language: "Rust",
  })),
}));

vi.mock("../../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../../server/level3/catalog", () => ({
  generateLevel3ChallengeMeta: hoisted.generateMetaMock,
}));

describe("/api/level3-preview", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.generateMetaMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.generateMetaMock.mockReturnValue({
      id: "l3:cpu-16bit-emulator:rust",
      taskName: "16-bit CPU Emulator",
      language: "Rust",
    });
  });

  it("returns preview payload for authenticated request", async () => {
    const { GET } = await import("../../src/app/api/level3-preview/route");
    const res = await GET(new Request("http://localhost/api/level3-preview"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      challengeId: string;
      taskName: string;
      language: string;
    };
    expect(body).toEqual({
      challengeId: "l3:cpu-16bit-emulator:rust",
      taskName: "16-bit CPU Emulator",
      language: "Rust",
    });
  });

  it("returns auth response when request is unauthorized", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { GET } = await import("../../src/app/api/level3-preview/route");
    const res = await GET(new Request("http://localhost/api/level3-preview"));

    expect(res.status).toBe(401);
  });
});
