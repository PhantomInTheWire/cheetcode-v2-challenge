import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { getLevel3ChallengeFromId } from "../../../../server/level3/problems";
import { normalizeTestCasesWithArgs } from "../../../lib/testcaseArgs";
import { ENV } from "../../../lib/env-vars";

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
  try {
    const body = await request.json().catch(() => ({}));
    requestedLevel = body.level;
    requestedLevel3ChallengeId = body.level3ChallengeId;
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
    });

    if (result.level === 1 && Array.isArray(result.problems)) {
      const normalizedProblems = (result.problems as SessionLevel1Problem[]).map((problem) => ({
        ...problem,
        testCases: normalizeTestCasesWithArgs(problem.signature, problem.testCases),
      }));
      result.problems = normalizedProblems as typeof result.problems;
    }

    if (result.level === 3) {
      const challengeMeta = (result.problems?.[0] ?? {}) as { id?: string; language?: string };
      const fullChallenge = challengeMeta.id ? getLevel3ChallengeFromId(challengeMeta.id) : null;
      if (fullChallenge && Array.isArray(result.problems) && result.problems.length > 0) {
        result.problems[0] = {
          id: fullChallenge.id,
          title: fullChallenge.title,
          taskId: fullChallenge.taskId,
          taskName: fullChallenge.taskName,
          language: fullChallenge.language,
          spec: fullChallenge.spec,
          starterCode: fullChallenge.starterCode,
          checks: fullChallenge.checks.map((c) => ({ id: c.id, name: c.name })),
        } as (typeof result.problems)[number];
      }
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create session";
    const status = message.includes("rate limited") ? 429 : 500;
    console.error("/api/session error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
