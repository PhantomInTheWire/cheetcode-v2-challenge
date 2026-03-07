import { NextResponse } from "next/server";
import { validateGithub } from "../validation";
import { auth } from "../../../auth";

const tokenCache = new Map<string, { username: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;
const GITHUB_API_URL = "https://api.github.com/user";

type GitHubUser = {
  login: string;
};

type AuthenticatedGithubResult =
  | { ok: true; github: string }
  | { ok: false; response: NextResponse };

async function verifyGitHubToken(token: string): Promise<string | null> {
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.username;
  }

  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: {
        Authorization: `token ${token}`,
        "User-Agent": "CheetCode-CTF",
      },
    });

    if (!res.ok) {
      console.warn(`GitHub PAT auth failed with status ${res.status}`);
      return null;
    }

    const user = (await res.json()) as GitHubUser;
    tokenCache.set(token, { username: user.login, expiresAt: Date.now() + CACHE_TTL_MS });
    return user.login;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`GitHub PAT auth error: ${message}`);
    return null;
  }
}

async function resolveGitHubFromHeader(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return await verifyGitHubToken(token);
}

export async function requireAuthenticatedGithub(
  request: Request,
): Promise<AuthenticatedGithubResult> {
  let resolvedGithub = await resolveGitHubFromHeader(request);
  if (!resolvedGithub) {
    const oauthSession = await auth();
    resolvedGithub = (oauthSession?.user as { githubUsername?: string })?.githubUsername ?? null;
  }

  if (!resolvedGithub) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "GitHub authentication required",
          hint: "Send a GitHub PAT via Authorization: Bearer <token>, or sign in with OAuth",
        },
        { status: 401 },
      ),
    };
  }

  const ghResult = validateGithub(resolvedGithub);
  if (ghResult.ok === false) {
    return { ok: false, response: NextResponse.json({ error: ghResult.error }, { status: 400 }) };
  }

  return { ok: true, github: ghResult.value };
}
