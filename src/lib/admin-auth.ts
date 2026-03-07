import { NextResponse } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { auth } from "../../auth";

function parseAdminGithubUsers(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminGithub(github: string): boolean {
  return parseAdminGithubUsers(process.env.ADMIN_GITHUB_USERS).includes(github.toLowerCase());
}

export async function requireAdminPageGithub(): Promise<string> {
  const session = await auth();
  const github = (session?.user as { githubUsername?: string } | undefined)?.githubUsername ?? "";
  if (!github) {
    redirect("/api/auth/signin");
  }
  if (!isAdminGithub(github)) {
    forbidden();
  }
  return github;
}

export function adminForbiddenResponse() {
  return NextResponse.json({ error: "admin access required" }, { status: 403 });
}
