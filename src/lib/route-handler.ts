import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "./request-auth";
import { requireOwnedSession } from "./session/session-auth";
import { getJsonBody, JsonBodyTooLargeError } from "./api-route";
import { ConvexHttpClient } from "convex/browser";

type OwnedSession = {
  github: string;
  problemIds: string[];
  startedAt: number;
  expiresAt: number;
  level?: number;
  publicPayloadJson?: string;
  level1CanaryProblemId?: string;
};

export const FINISH_ROUTE_EXPIRY_GRACE_MS = 5_000;
export const LEVEL3_FINISH_EXPIRY_GRACE_MS = 10_000;

type OwnedSessionRouteOptions<TBody extends { sessionId: string }, TDerived extends object> = {
  expectedLevel?: 1 | 2 | 3;
  expiryGraceMs?: number;
  parseBody?: (request: Request) => Promise<unknown>;
  validateBody: (body: unknown) => body is TBody;
  invalidBodyResponse?: NextResponse;
  bodyTooLargeResponse?: NextResponse;
  errorResponse?: NextResponse;
  errorLabel: string;
  deriveContext?: (ctx: { body: TBody; session: OwnedSession }) => TDerived | NextResponse;
};

/**
 * Common orchestration for routes bound to an existing session:
 * 1. Parse + validate body
 * 2. Authenticate GitHub
 * 3. Verify session ownership, expiry, and optional level
 * 4. Derive any identifiers that must come from the owned session
 */
export async function withOwnedSessionRoute<
  TBody extends { sessionId: string },
  TDerived extends object = Record<string, never>,
>(
  request: Request,
  options: OwnedSessionRouteOptions<TBody, TDerived>,
  handler: (
    ctx: {
      github: string;
      session: OwnedSession;
      convex: ConvexHttpClient;
      body: TBody;
    } & TDerived,
  ) => Promise<NextResponse>,
) {
  try {
    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const { github } = authResult;

    const body = await (options.parseBody
      ? options.parseBody(request)
      : getJsonBody<unknown>(request));
    if (!options.validateBody(body)) {
      return (
        options.invalidBodyResponse ??
        NextResponse.json({ error: "invalid request" }, { status: 400 })
      );
    }

    const sessionResult = await requireOwnedSession(body.sessionId, github, options.expectedLevel, {
      expiryGraceMs: options.expiryGraceMs,
    });
    if ("response" in sessionResult) return sessionResult.response;
    const { session, convex } = sessionResult;

    const derived = options.deriveContext?.({ body, session });
    if (derived instanceof NextResponse) return derived;

    return await handler({
      github,
      session,
      convex,
      body,
      ...(derived ?? ({} as TDerived)),
    });
  } catch (err) {
    if (err instanceof JsonBodyTooLargeError) {
      return (
        options.bodyTooLargeResponse ??
        NextResponse.json({ error: "request body too large" }, { status: 413 })
      );
    }
    console.error(`${options.errorLabel}:`, err);
    return (
      options.errorResponse ??
      NextResponse.json({ error: "internal server error" }, { status: 500 })
    );
  }
}

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
  return withOwnedSessionRoute<TBody>(
    request,
    {
      expectedLevel,
      expiryGraceMs: FINISH_ROUTE_EXPIRY_GRACE_MS,
      validateBody: (body): body is TBody =>
        !!body &&
        typeof body === "object" &&
        typeof (body as { sessionId?: unknown }).sessionId === "string",
      errorLabel: `Route handler error (Level ${expectedLevel})`,
      errorResponse: NextResponse.json(
        { error: "internal server error", elo: 0, solved: 0, rank: 0, timeRemaining: 0 },
        { status: 500 },
      ),
    },
    handler,
  );
}

export function getAssignedLevel3ChallengeId(problemIds: string[]): string | null {
  const assignedProblemId = problemIds[0];
  if (!assignedProblemId) return null;
  const lastSeparator = assignedProblemId.lastIndexOf(":");
  if (lastSeparator <= 0) return assignedProblemId;
  return assignedProblemId.slice(0, lastSeparator);
}
