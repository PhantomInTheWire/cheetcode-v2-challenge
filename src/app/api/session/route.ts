import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { getLevel3ChallengeFromId } from "../../../../server/level3/problems";
import { normalizeTestCasesWithArgs } from "../../../lib/testcaseArgs";
import { ENV } from "../../../lib/env-vars";
import { recordSessionIdentity } from "../../../lib/session/session-identity";
import { recordSessionFingerprint } from "../../../lib/session/session-fingerprint";
import type { RestoredSessionPayload } from "../../../lib/gameTypes";
import {
  buildLevel1SessionPayload,
  buildLevel2SessionPayload,
  buildLevel3SessionPayload,
} from "../../../lib/session/session-payload";
import {
  parseUnverifiedFingerprintHints,
  type UnverifiedFingerprintHints,
} from "../../../lib/fingerprint/fingerprint-shared";

type SessionLevel1Problem = {
  id: string;
  title: string;
  tier: "easy" | "medium" | "hard" | "competitive";
  description: string;
  signature: string;
  starterCode: string;
  testCases: Array<{ input: Record<string, unknown>; expected: unknown; args?: unknown[] }>;
};

/**
 * POST /api/session
 * Creates a game session. Supports two auth methods:
 *   1. GitHub PAT via Authorization header (API agents)
 *   2. OAuth session cookie (browser users)
 */
export async function POST(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  const { github } = authResult;

  // Parse request body for level selection
  let requestedLevel: number | undefined;
  let requestedLevel3ChallengeId: string | undefined;
  let requestedLevel2Projects: string[] | undefined;
  let fingerprintHints: UnverifiedFingerprintHints | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    requestedLevel = body.level;
    requestedLevel3ChallengeId = body.level3ChallengeId;
    requestedLevel2Projects = Array.isArray(body.level2Projects)
      ? body.level2Projects.filter((entry: unknown): entry is string => typeof entry === "string")
      : undefined;
    fingerprintHints = parseUnverifiedFingerprintHints(
      body.fingerprintHints ?? body.fingerprintProfile,
    );
  } catch {
    // Ignore parse errors, use default
  }

  try {
    const convexUrl = ENV.NEXT_PUBLIC_CONVEX_URL;
    const mutationSecret = ENV.CONVEX_MUTATION_SECRET;

    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.action(api.sessions.create, {
      secret: mutationSecret,
      github,
      requestedLevel,
      requestedLevel3ChallengeId,
      requestedLevel2Projects,
    });
    const sessionMeta = {
      sessionId: result.sessionId,
      startedAt: result.startedAt,
      expiresAt: result.expiresAt,
      scoreSnapshot: result.scoreSnapshot,
    };
    let payload: RestoredSessionPayload<string>;

    if (result.level === 1 && Array.isArray(result.problems)) {
      const normalizedProblems = (result.problems as SessionLevel1Problem[]).map((problem) => ({
        ...problem,
        testCases: normalizeTestCasesWithArgs(problem.signature, problem.testCases),
      }));
      payload = buildLevel1SessionPayload(sessionMeta, normalizedProblems);
    } else if (result.level === 3) {
      const challengeMeta = (result.problems?.[0] ?? {}) as { id?: string; language?: string };
      const fullChallenge = challengeMeta.id ? getLevel3ChallengeFromId(challengeMeta.id) : null;
      if (fullChallenge && Array.isArray(result.problems) && result.problems.length > 0) {
        payload = buildLevel3SessionPayload(sessionMeta, [
          {
            id: fullChallenge.id,
            title: fullChallenge.title,
            taskId: fullChallenge.taskId,
            taskName: fullChallenge.taskName,
            language: fullChallenge.language,
            spec: fullChallenge.spec,
            starterCode: fullChallenge.starterCode,
            checks: fullChallenge.checks.map((c) => ({ id: c.id, name: c.name })),
          },
        ]);
      } else if (Array.isArray(result.problems)) {
        payload = buildLevel3SessionPayload(
          sessionMeta,
          result.problems as Array<{
            id: string;
            title: string;
            taskId: string;
            taskName: string;
            language: string;
            spec: string;
            starterCode: string;
            checks: Array<{ id: string; name: string }>;
          }>,
        );
      } else {
        throw new Error("invalid level 3 session payload");
      }
    } else if (result.level === 2 && Array.isArray(result.problems)) {
      payload = buildLevel2SessionPayload(
        sessionMeta,
        result.problems as Array<{
          id: string;
          question: string;
          project?: "chromium" | "firefox" | "libreoffice" | "postgres";
        }>,
      );
    } else {
      const normalizedProblems = (result.problems as SessionLevel1Problem[]).map((problem) => ({
        ...problem,
        testCases: normalizeTestCasesWithArgs(problem.signature, problem.testCases),
      }));
      payload = buildLevel1SessionPayload(sessionMeta, normalizedProblems);
    }

    await recordSessionIdentity({
      convex,
      secret: mutationSecret,
      request,
      sessionId: result.sessionId as Id<"sessions">,
      github,
      level: result.level as 1 | 2 | 3,
      route: "/api/session",
      screen: "playing",
    });

    await recordSessionFingerprint({
      convex,
      secret: mutationSecret,
      sessionId: result.sessionId as Id<"sessions">,
      github,
      level: result.level as 1 | 2 | 3,
      route: "/api/session",
      screen: "playing",
      fingerprintHints,
    });

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    const status = message.includes("rate limited") ? 429 : message.includes("locked") ? 403 : 500;
    console.error("/api/session error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
