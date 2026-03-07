import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { requireAuthenticatedGithub } from "../../../../lib/request-auth";
import { ENV } from "../../../../lib/env-vars";
import {
  SESSION_REPLAY_EVENT_TYPES,
  type SessionReplayEventType,
} from "../../../../lib/session-replay-contract";
import { recordSessionReplayEvent } from "../../../../lib/session-replay";
import { recordSessionIdentity } from "../../../../lib/session-identity";

type ReplayBody = {
  sessionId?: string;
  level?: number;
  eventType?: string;
  screen?: string;
  route?: string;
  clientAt?: number;
  summary?: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
};

type StoredSession = {
  github: string;
  level?: number;
};

function isReplayEventType(value: string | undefined): value is SessionReplayEventType {
  return (
    typeof value === "string" &&
    SESSION_REPLAY_EVENT_TYPES.includes(value as SessionReplayEventType)
  );
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;

  const body = (await request.json().catch(() => ({}))) as ReplayBody;
  if (!body.sessionId || !body.screen || !isReplayEventType(body.eventType)) {
    return NextResponse.json(
      { error: "sessionId, screen, and valid eventType are required" },
      { status: 400 },
    );
  }

  const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
  const session = (await convex.query(
    (api as typeof api & { submissions: { getSession: unknown } }).submissions.getSession,
    {
      sessionId: body.sessionId as Id<"sessions">,
    },
  )) as StoredSession | null;

  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.github !== authResult.github) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const level = body.level ?? session.level ?? 1;
  if (level !== 1 && level !== 2 && level !== 3) {
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }

  await recordSessionReplayEvent({
    convex,
    secret: ENV.CONVEX_MUTATION_SECRET,
    sessionId: body.sessionId as Id<"sessions">,
    github: authResult.github,
    level,
    eventType: body.eventType,
    screen: body.screen,
    route: body.route ?? "/",
    clientAt: typeof body.clientAt === "number" ? body.clientAt : undefined,
    summary: body.summary ?? {},
    snapshot: body.snapshot,
  });

  await recordSessionIdentity({
    convex,
    secret: ENV.CONVEX_MUTATION_SECRET,
    request,
    sessionId: body.sessionId as Id<"sessions">,
    github: authResult.github,
    level,
    route: body.route ?? "/api/session/replay",
    screen: body.screen,
  });

  return NextResponse.json({ ok: true });
}
