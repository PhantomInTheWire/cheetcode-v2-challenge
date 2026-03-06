import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ENV } from "../../../../lib/env-vars";
import { requireAuthenticatedGithub } from "../../../../lib/request-auth";
import { normalizeTestCasesWithArgs } from "../../../../lib/testcaseArgs";
import {
  PROBLEM_BANK,
  injectDescriptionCanaryAtProblemId,
} from "../../../../../server/level1/problems";
import { LEVEL2_PROBLEMS } from "../../../../../server/level2/problems";
import { getLevel3ChallengeFromId } from "../../../../../server/level3/problems";

type StoredSession = {
  github: string;
  problemIds: string[];
  startedAt: number;
  expiresAt: number;
  level?: number;
  publicPayloadJson?: string;
  level1CanaryProblemId?: string;
};

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  const { github } = authResult;

  try {
    const body = (await request.json().catch(() => ({}))) as { sessionId?: string };
    if (!body.sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
    const session = (await convex.query(api.submissions.getSession, {
      sessionId: body.sessionId as Id<"sessions">,
    })) as StoredSession | null;

    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    if (session.github !== github) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (session.expiresAt <= Date.now()) {
      return NextResponse.json({ error: "session expired" }, { status: 410 });
    }

    const level = session.level ?? 1;
    const restoredPayload = session.publicPayloadJson
      ? ((JSON.parse(session.publicPayloadJson) as Record<string, unknown>[]) ?? [])
      : null;

    if (level === 1) {
      const byId = new Map(PROBLEM_BANK.map((problem) => [problem.id, problem]));
      const baseProblems = session.problemIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((problem) => ({
          id: problem!.id,
          title: problem!.title,
          tier: problem!.tier,
          description: problem!.description,
          signature: problem!.signature,
          starterCode: problem!.starterCode,
          testCases: normalizeTestCasesWithArgs(problem!.signature, problem!.testCases),
        }));
      const problems = session.level1CanaryProblemId
        ? injectDescriptionCanaryAtProblemId(baseProblems, session.level1CanaryProblemId)
        : baseProblems;

      return NextResponse.json({
        sessionId: body.sessionId,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        level,
        problems,
      });
    }

    if (level === 2) {
      if (restoredPayload) {
        return NextResponse.json({
          sessionId: body.sessionId,
          startedAt: session.startedAt,
          expiresAt: session.expiresAt,
          level,
          problems: restoredPayload,
        });
      }
      const byId = new Map(LEVEL2_PROBLEMS.map((problem) => [problem.id, problem]));
      const problems = session.problemIds
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((problem) => ({
          id: problem!.id,
          project: problem!.project,
          question: problem!.question,
        }));

      return NextResponse.json({
        sessionId: body.sessionId,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        level,
        problems,
      });
    }

    const firstCheckId = session.problemIds[0];
    const challengeId = firstCheckId?.slice(0, firstCheckId.lastIndexOf(":"));
    const challenge = challengeId ? getLevel3ChallengeFromId(challengeId) : null;
    if (!challenge) {
      return NextResponse.json({ error: "challenge not found" }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: body.sessionId,
      startedAt: session.startedAt,
      expiresAt: session.expiresAt,
      level,
      problems: restoredPayload ?? [
        {
          id: challenge.id,
          title: challenge.title,
          taskId: challenge.taskId,
          taskName: challenge.taskName,
          language: challenge.language,
          spec: challenge.spec,
          starterCode: challenge.starterCode,
          checks: challenge.checks.map((check) => ({ id: check.id, name: check.name })),
        },
      ],
    });
  } catch (err) {
    console.error("/api/session/restore error:", err);
    return NextResponse.json({ error: "Failed to restore session" }, { status: 500 });
  }
}
