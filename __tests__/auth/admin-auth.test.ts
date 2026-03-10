import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../auth", () => ({
  auth: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) => Response.json(body, init),
  },
}));

vi.mock("next/navigation", () => ({
  forbidden: vi.fn(),
  redirect: vi.fn(),
}));

describe("admin auth helpers", () => {
  beforeEach(() => {
    process.env.ADMIN_GITHUB_USERS = "ghost,teammate";
  });

  it("matches usernames case-insensitively", async () => {
    const { isAdminGithub } = await import("../../src/lib/admin-auth");
    expect(isAdminGithub("ghost")).toBe(true);
    expect(isAdminGithub("Ghost")).toBe(true);
    expect(isAdminGithub("outsider")).toBe(false);
  });
});
