import { NextResponse } from "next/server";
import { forbidden, redirect } from "next/navigation";
import { auth } from "../../auth";

type AdminSessionUser = {
  githubUsername?: string | null;
  image?: string | null;
  name?: string | null;
};

export type AdminPageIdentity = {
  github: string;
  image: string | null;
  name: string | null;
};

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
  return (await requireAdminPageIdentity()).github;
}

export async function requireAdminPageIdentity(): Promise<AdminPageIdentity> {
  const session = await auth();
  const user = (session?.user as AdminSessionUser | undefined) ?? {};
  const github = user.githubUsername ?? "";
  if (!github) {
    redirect("/api/auth/signin");
  }
  if (!isAdminGithub(github)) {
    forbidden();
  }
  return {
    github,
    image: user.image ?? null,
    name: user.name ?? null,
  };
}

export function adminForbiddenResponse() {
  return NextResponse.json({ error: "admin access required" }, { status: 403 });
}
