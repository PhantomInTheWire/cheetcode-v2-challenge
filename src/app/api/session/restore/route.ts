import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { normalizeTestCasesWithArgs } from "../../../../lib/game/testcaseArgs";
import {
  PROBLEM_BANK,
  injectDescriptionCanaryAtProblemId,
} from "../../../../../server/level1/problems";
import { LEVEL2_PROBLEMS } from "../../../../../server/level2/problems";
import { getLevel3ChallengeFromId } from "../../../../../server/level3/problems";
import type { Level2Problem, Level3ChallengeState } from "../../../../lib/game/gameTypes";
import {
  buildLevel3ChallengeState,
  getAssignedLevel3ChallengeId,
  buildLevel1SessionPayload,
  buildLevel2SessionPayload,
  buildLevel3SessionPayload,
} from "../../../../lib/session/session-payload";
import { parseUnverifiedFingerprintHints } from "../../../../lib/fingerprint/fingerprint-shared";
import {
  applyTrustedFingerprintCookie,
  resolveFingerprintTrust,
} from "../../../../lib/fingerprint/server-trust";
import { withOwnedSessionRoute } from "../../../../lib/routes/route-handler";

export async function POST(request: Request) {
  return withOwnedSessionRoute<{
    sessionId: string;
    fingerprintHints?: unknown;
    fingerprintProfile?: unknown;
  }>(
    request,
    {
      validateBody: (
        body,
      ): body is { sessionId: string; fingerprintHints?: unknown; fingerprintProfile?: unknown } =>
        !!body &&
        typeof body === "object" &&
        typeof (body as { sessionId?: unknown }).sessionId === "string",
      invalidBodyResponse: NextResponse.json({ error: "sessionId required" }, { status: 400 }),
      errorLabel: "/api/session/restore error",
      errorResponse: NextResponse.json({ error: "Failed to restore session" }, { status: 500 }),
    },
    async ({ github, convex, session, body }) => {
      const fingerprintHints = parseUnverifiedFingerprintHints(
        body.fingerprintHints ?? body.fingerprintProfile,
      );
      const fingerprintTrust = await resolveFingerprintTrust(request, fingerprintHints, {
        allowPromotion: true,
      });
      const scoreSnapshot = await convex.query(api.leaderboard.getPlayerSnapshot, { github });
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

        const response = NextResponse.json(
          buildLevel1SessionPayload(
            {
              sessionId: body.sessionId,
              startedAt: session.startedAt,
              expiresAt: session.expiresAt,
              scoreSnapshot,
            },
            problems,
          ),
        );
        if (fingerprintTrust.cookiePayloadToSet) {
          await applyTrustedFingerprintCookie(response, fingerprintTrust.cookiePayloadToSet);
        }
        return response;
      }

      if (level === 2) {
        if (restoredPayload) {
          const response = NextResponse.json(
            buildLevel2SessionPayload(
              {
                sessionId: body.sessionId,
                startedAt: session.startedAt,
                expiresAt: session.expiresAt,
                scoreSnapshot,
              },
              restoredPayload as Level2Problem[],
            ),
          );
          if (fingerprintTrust.cookiePayloadToSet) {
            await applyTrustedFingerprintCookie(response, fingerprintTrust.cookiePayloadToSet);
          }
          return response;
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

        const response = NextResponse.json(
          buildLevel2SessionPayload(
            {
              sessionId: body.sessionId,
              startedAt: session.startedAt,
              expiresAt: session.expiresAt,
              scoreSnapshot,
            },
            problems,
          ),
        );
        if (fingerprintTrust.cookiePayloadToSet) {
          await applyTrustedFingerprintCookie(response, fingerprintTrust.cookiePayloadToSet);
        }
        return response;
      }

      const challengeId = getAssignedLevel3ChallengeId(session.problemIds);
      const challenge = challengeId ? getLevel3ChallengeFromId(challengeId) : null;
      if (!challenge) {
        return NextResponse.json({ error: "challenge not found" }, { status: 404 });
      }

      const response = NextResponse.json(
        buildLevel3SessionPayload(
          {
            sessionId: body.sessionId,
            startedAt: session.startedAt,
            expiresAt: session.expiresAt,
            scoreSnapshot,
          },
          (restoredPayload as Level3ChallengeState[] | null) ?? [
            buildLevel3ChallengeState(challenge),
          ],
        ),
      );
      if (fingerprintTrust.cookiePayloadToSet) {
        await applyTrustedFingerprintCookie(response, fingerprintTrust.cookiePayloadToSet);
      }
      return response;
    },
  );
}
