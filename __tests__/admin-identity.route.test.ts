import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "admin" })),
  queryMock: vi.fn(),
  getKvClientMock: vi.fn(() => null),
  getKvShadowBanStatesMock: vi.fn(async () => ({})),
  setKvShadowBanMock: vi.fn(async () => {}),
  clearKvShadowBanMock: vi.fn(async () => {}),
  isAdminGithubMock: vi.fn(() => true),
  localIsBannedMock: vi.fn(() => false),
  localSetBanMock: vi.fn(),
  localClearBanMock: vi.fn(),
}));

vi.mock("../src/lib/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("../src/lib/admin-auth", () => ({
  isAdminGithub: hoisted.isAdminGithubMock,
  adminForbiddenResponse: () => Response.json({ error: "forbidden" }, { status: 403 }),
}));

vi.mock("../src/lib/abuse/kv", () => ({
  getKvClient: hoisted.getKvClientMock,
  getKvShadowBanStates: hoisted.getKvShadowBanStatesMock,
  setKvShadowBan: hoisted.setKvShadowBanMock,
  clearKvShadowBan: hoisted.clearKvShadowBanMock,
}));

vi.mock("../src/lib/abuse/guard", () => ({
  isIdentityKeyShadowBanned: hoisted.localIsBannedMock,
  setShadowBanForIdentityKey: hoisted.localSetBanMock,
  clearShadowBanForIdentityKey: hoisted.localClearBanMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = hoisted.queryMock;
  },
}));

describe("/api/admin/identity", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.queryMock.mockReset();
    hoisted.getKvClientMock.mockReset();
    hoisted.getKvShadowBanStatesMock.mockReset();
    hoisted.setKvShadowBanMock.mockReset();
    hoisted.clearKvShadowBanMock.mockReset();
    hoisted.isAdminGithubMock.mockReset();
    hoisted.localIsBannedMock.mockReset();
    hoisted.localSetBanMock.mockReset();
    hoisted.localClearBanMock.mockReset();

    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "admin" });
    hoisted.isAdminGithubMock.mockReturnValue(true);
    hoisted.getKvClientMock.mockReturnValue({ connected: true });
    hoisted.getKvShadowBanStatesMock.mockResolvedValue({ "fp:aaaaaaaaaaaaaaaa": true });
    hoisted.localIsBannedMock.mockReturnValue(false);
    hoisted.queryMock.mockResolvedValue([
      {
        _id: "1",
        sessionId: "s1",
        github: "alice",
        level: 1,
        identityKey: "fp:aaaaaaaaaaaaaaaa",
        identityKind: "fp",
        route: "/api/session",
        screen: "playing",
        firstSeenAt: 10,
        lastSeenAt: 20,
      },
      {
        _id: "2",
        sessionId: "s2",
        github: "bob",
        level: 1,
        identityKey: "fp:aaaaaaaaaaaaaaaa",
        identityKind: "fp",
        route: "/api/session",
        screen: "playing",
        firstSeenAt: 15,
        lastSeenAt: 25,
      },
    ]);
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  });

  it("returns clustered identity graph data", async () => {
    const { GET } = await import("../src/app/api/admin/identity/route");
    const res = await GET(new Request("http://localhost/api/admin/identity?limit=100"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      clusters: Array<{ accountCount: number; shadowBanned: boolean }>;
    };
    expect(body.clusters[0]?.accountCount).toBe(2);
    expect(body.clusters[0]?.shadowBanned).toBe(true);
  });

  it("updates local shadow bans when kv is unavailable", async () => {
    hoisted.getKvClientMock.mockReturnValueOnce(null);
    const { POST } = await import("../src/app/api/admin/identity/route");
    const res = await POST(
      new Request("http://localhost/api/admin/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "shadow_ban",
          identityKeys: ["fp:aaaaaaaaaaaaaaaa"],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(hoisted.localSetBanMock).toHaveBeenCalledWith("fp:aaaaaaaaaaaaaaaa");
  });

  it("rejects unknown admin actions instead of treating them as unshadow bans", async () => {
    const { POST } = await import("../src/app/api/admin/identity/route");
    const res = await POST(
      new Request("http://localhost/api/admin/identity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "shadow-ban",
          identityKeys: ["fp:aaaaaaaaaaaaaaaa"],
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(hoisted.setKvShadowBanMock).not.toHaveBeenCalled();
    expect(hoisted.clearKvShadowBanMock).not.toHaveBeenCalled();
    expect(hoisted.localSetBanMock).not.toHaveBeenCalled();
    expect(hoisted.localClearBanMock).not.toHaveBeenCalled();
  });
});
