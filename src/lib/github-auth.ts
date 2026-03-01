/**
 * Verify a GitHub identity from an Authorization header.
 * Supports both PAT (ghp_...) and OAuth session fallback.
 *
 * For API-based agents: send `Authorization: Bearer <PAT>`
 * For browser agents: OAuth session is used automatically
 */

// Brief cache to avoid hammering GitHub API on rapid successive calls
const tokenCache = new Map<string, { username: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute
const GITHUB_API_URL = "https://api.github.com/user";

/** Verify a GitHub PAT and return the associated username, or null if invalid */
async function verifyGitHubToken(token: string): Promise<string | null> {
  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.username;
  }

  try {
    const res = await fetch(GITHUB_API_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const username = data.login as string | undefined;
    if (!username) return null;

    // Cache the result
    tokenCache.set(token, { username, expiresAt: Date.now() + CACHE_TTL_MS });
    return username;
  } catch {
    return null;
  }
}

/**
 * Extract the GitHub username from a request.
 * Checks Authorization header (PAT) first, returns null if not present/invalid.
 */
export async function resolveGitHubFromHeader(
  request: Request,
): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return await verifyGitHubToken(token);
}
