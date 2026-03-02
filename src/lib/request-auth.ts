import { NextResponse } from "next/server";
import { resolveGitHubFromHeader } from "./github-auth";
import { validateGithub } from "./validation";
import { auth } from "../../auth";

export type AuthenticatedGithubResult =
  | { ok: true; github: string }
  | { ok: false; response: NextResponse };

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
