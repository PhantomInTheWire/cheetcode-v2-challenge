import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveGitHubFromHeader: vi.fn<(request: Request) => Promise<string | null>>(),
  auth: vi.fn<() => Promise<{ user?: { githubUsername?: string } } | null>>(),
}));

vi.mock("../src/lib/github-auth", () => ({
  resolveGitHubFromHeader: mocks.resolveGitHubFromHeader,
}));

vi.mock("../auth", () => ({
  auth: mocks.auth,
}));

import { requireAuthenticatedGithub } from "../src/lib/request-auth";

describe("requireAuthenticatedGithub", () => {
  beforeEach(() => {
    mocks.resolveGitHubFromHeader.mockReset();
    mocks.auth.mockReset();
  });

  it("returns github from Authorization header when available", async () => {
    mocks.resolveGitHubFromHeader.mockResolvedValue("octocat");
    const result = await requireAuthenticatedGithub(new Request("https://example.com"));

    expect(result).toEqual({ ok: true, github: "octocat" });
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it("falls back to OAuth session github username", async () => {
    mocks.resolveGitHubFromHeader.mockResolvedValue(null);
    mocks.auth.mockResolvedValue({ user: { githubUsername: "firecrawler" } });

    const result = await requireAuthenticatedGithub(new Request("https://example.com"));
    expect(result).toEqual({ ok: true, github: "firecrawler" });
  });

  it("returns unauthorized response when no github identity exists", async () => {
    mocks.resolveGitHubFromHeader.mockResolvedValue(null);
    mocks.auth.mockResolvedValue(null);

    const result = await requireAuthenticatedGithub(new Request("https://example.com"));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected unauthorized result");
    expect(result.response.status).toBe(401);
  });
});
