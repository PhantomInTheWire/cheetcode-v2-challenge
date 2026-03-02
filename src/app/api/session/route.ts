import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { resolveGitHubFromHeader } from "../../../lib/github-auth";
import { auth } from "../../../../auth";
import { warmLevel3Runtime } from "../../../../server/level3/validation";
import { getLevel3ChallengeFromId } from "../../../../server/level3/problems";
import { normalizeTestCasesWithArgs } from "../../../lib/testcaseArgs";

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
  // Try PAT first (API agents), then fall back to OAuth session (browser)
  let github = await resolveGitHubFromHeader(request);

  if (!github) {
    const session = await auth();
    github = (session?.user as { githubUsername?: string })?.githubUsername ?? null;
  }

  if (!github) {
    return NextResponse.json(
      {
        error: "GitHub authentication required",
        hint: "Send a GitHub PAT via Authorization: Bearer <token>, or sign in with OAuth",
      },
      { status: 401 },
    );
  }

  // Parse request body for level selection
  let requestedLevel: number | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    requestedLevel = body.level;
  } catch {
    // Ignore parse errors, use default
  }

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const hasSecret = !!process.env.CONVEX_MUTATION_SECRET;
    if (!convexUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_CONVEX_URL not configured" }, { status: 500 });
    }
    if (!hasSecret) {
      return NextResponse.json({ error: "CONVEX_MUTATION_SECRET not configured" }, { status: 500 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.action(api.sessions.create, {
      secret: process.env.CONVEX_MUTATION_SECRET!,
      github,
      requestedLevel,
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
      if (challengeMeta.language) {
        void warmLevel3Runtime(challengeMeta.language);
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
