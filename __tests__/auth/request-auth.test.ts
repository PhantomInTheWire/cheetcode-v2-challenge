import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn<[], Promise<{ user?: { githubUsername?: string } } | null>>(),
  fetch: vi.fn(),
}));

vi.mock("../../auth", () => ({
  auth: mocks.auth,
}));

import { requireAuthenticatedGithub } from "../../src/lib/auth/request-auth";

describe("requireAuthenticatedGithub", () => {
  beforeEach(() => {
    mocks.auth.mockReset();
    mocks.fetch.mockReset();
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("returns github from Authorization header when available", async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ login: "octocat" }),
    });

    const result = await requireAuthenticatedGithub(
      new Request("https://example.com", {
        headers: { Authorization: "Bearer test-token" },
      }),
    );

    expect(result).toEqual({ ok: true, github: "octocat" });
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("falls back to OAuth session github username", async () => {
    mocks.auth.mockResolvedValue({ user: { githubUsername: "firecrawler" } });

    const result = await requireAuthenticatedGithub(new Request("https://example.com"));
    expect(result).toEqual({ ok: true, github: "firecrawler" });
  });

  it("returns unauthorized response when no github identity exists", async () => {
    mocks.auth.mockResolvedValue(null);

    const result = await requireAuthenticatedGithub(new Request("https://example.com"));
    expect(result.ok).toBe(false);
    if (result.ok !== false) throw new Error("expected unauthorized result");
    expect(result.response.status).toBe(401);
  });
});
