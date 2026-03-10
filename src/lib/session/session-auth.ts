import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ENV } from "../env-vars";

type OwnedSession = {
  github: string;
  startedAt: number;
  expiresAt: number;
  level?: number;
  problemIds: string[];
};

export async function requireOwnedSession(
  sessionId: string,
  github: string,
  expectedLevel?: 1 | 2 | 3,
  options?: { expiryGraceMs?: number },
): Promise<{ session: OwnedSession; convex: ConvexHttpClient } | { response: NextResponse }> {
  const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
  const session = (await convex.query(api.submissions.getSession, {
    secret: ENV.CONVEX_MUTATION_SECRET,
    sessionId: sessionId as Id<"sessions">,
  })) as OwnedSession | null;

  if (!session) {
    return { response: NextResponse.json({ error: "session not found" }, { status: 404 }) };
  }
  if (session.github !== github) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  const expiryGraceMs = Math.max(0, options?.expiryGraceMs ?? 0);
  if (session.expiresAt + expiryGraceMs <= Date.now()) {
    return { response: NextResponse.json({ error: "session expired" }, { status: 410 }) };
  }
  if (expectedLevel && (session.level ?? 1) !== expectedLevel) {
    return {
      response: NextResponse.json(
        { error: `session is not level ${expectedLevel}` },
        { status: 400 },
      ),
    };
  }

  return { session, convex };
}
