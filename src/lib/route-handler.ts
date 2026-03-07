import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "./request-auth";
import { requireOwnedSession } from "./session-auth";
import { getJsonBody } from "./api-route";
import { ConvexHttpClient } from "convex/browser";

type OwnedSession = {
  github: string;
  problemIds: string[];
  startedAt: number;
  expiresAt: number;
  level?: number;
};

/**
 * Common orchestration for "finish" routes:
 * 1. Parse body
 * 2. Authenticate GitHub
 * 3. Verify session ownership and level
 * 4. Execute level-specific logic
 */
export const FINISH_ROUTE_EXPIRY_GRACE_MS = 5_000;

export async function withAuthenticatedSession<TBody extends { sessionId: string }>(
  request: Request,
  expectedLevel: 1 | 2 | 3,
  handler: (ctx: {
    github: string;
    session: OwnedSession;
    convex: ConvexHttpClient;
    body: TBody;
  }) => Promise<NextResponse>,
) {
  try {
    const body = await getJsonBody<TBody>(request);
    if (!body || !body.sessionId) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const { github } = authResult;

    const sessionResult = await requireOwnedSession(body.sessionId, github, expectedLevel, {
      expiryGraceMs: FINISH_ROUTE_EXPIRY_GRACE_MS,
    });
    if ("response" in sessionResult) return sessionResult.response;
    const { session, convex } = sessionResult;

    return await handler({ github, session, convex, body });
  } catch (err) {
    console.error(`Route handler error (Level ${expectedLevel}):`, err);
    return NextResponse.json(
      { error: "internal server error", elo: 0, solved: 0, rank: 0, timeRemaining: 0 },
      { status: 500 },
    );
  }
}
