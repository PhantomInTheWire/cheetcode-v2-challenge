import { after, NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getLevel3ChallengeFromId } from "../../../../server/level3/problems";
import { normalizeTestCasesWithArgs } from "../../../lib/game/testcaseArgs";
import { ENV } from "../../../lib/config/env";
import { TRUSTED_FINGERPRINT_HEADER } from "../../../lib/abuse/identity";
import { recordSessionIdentity } from "../../../lib/session/session-identity";
import { recordSessionFingerprint } from "../../../lib/session/session-fingerprint";
import type { RestoredSessionPayload } from "../../../lib/game/gameTypes";
import {
  buildLevel3ChallengeState,
  buildLevel1SessionPayload,
  buildLevel2SessionPayload,
  buildLevel3SessionPayload,
} from "../../../lib/session/session-payload";
import {
  parseUnverifiedFingerprintHints,
  type UnverifiedFingerprintHints,
} from "../../../lib/fingerprint/fingerprint-shared";
import { normalizeClientFingerprint } from "../../../lib/fingerprint/fingerprint-contract";
import {
  applyTrustedFingerprintCookie,
  resolveFingerprintTrust,
} from "../../../lib/fingerprint/server-trust";
import type { GameProblem, Level2Problem } from "../../../lib/game/gameTypes";
import { withAuthenticatedConvexRoute } from "../../../lib/routes/authenticated-route";

function buildIdentityRecordingRequest(
  request: Request,
  trustedFingerprint: string | null,
): Request {
  const bootstrapFingerprint = normalizeClientFingerprint(
    request.headers.get("x-client-fingerprint"),
  );
  const effectiveTrustedFingerprint =
    trustedFingerprint ?? (bootstrapFingerprint ? `bootstrap:${bootstrapFingerprint}` : null);
  if (!effectiveTrustedFingerprint) return request;
  const headers = new Headers(request.headers);
  headers.set(TRUSTED_FINGERPRINT_HEADER, effectiveTrustedFingerprint);
  return new Request(request.url, {
    method: request.method,
    headers,
  });
}

/**
 * POST /api/session
 * Creates a game session. Supports two auth methods:
 *   1. GitHub PAT via Authorization header (API agents)
 *   2. OAuth session cookie (browser users)
 */
export async function POST(request: Request) {
  return withAuthenticatedConvexRoute(request, async ({ github, convex }) => {
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
      const fingerprintTrust = await resolveFingerprintTrust(request, fingerprintHints, {
        allowPromotion: true,
      });
      const trustedFingerprintSummary = fingerprintTrust.summary;
      const mutationSecret = ENV.CONVEX_MUTATION_SECRET;

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
        const normalizedProblems = (result.problems as GameProblem[]).map((problem) => ({
          ...problem,
          testCases: normalizeTestCasesWithArgs(problem.signature, problem.testCases),
        }));
        payload = buildLevel1SessionPayload(sessionMeta, normalizedProblems);
      } else if (result.level === 3) {
        const challengeMeta = (result.problems?.[0] ?? {}) as { id?: string };
        const fullChallenge = challengeMeta.id ? getLevel3ChallengeFromId(challengeMeta.id) : null;
        if (fullChallenge && Array.isArray(result.problems) && result.problems.length > 0) {
          payload = buildLevel3SessionPayload(sessionMeta, [
            buildLevel3ChallengeState(fullChallenge),
          ]);
        } else if (Array.isArray(result.problems)) {
          payload = buildLevel3SessionPayload(
            sessionMeta,
            result.problems.map(buildLevel3ChallengeState),
          );
        } else {
          throw new Error("invalid level 3 session payload");
        }
      } else if (result.level === 2 && Array.isArray(result.problems)) {
        payload = buildLevel2SessionPayload(sessionMeta, result.problems as Level2Problem[]);
      } else {
        const normalizedProblems = (result.problems as GameProblem[]).map((problem) => ({
          ...problem,
          testCases: normalizeTestCasesWithArgs(problem.signature, problem.testCases),
        }));
        payload = buildLevel1SessionPayload(sessionMeta, normalizedProblems);
      }

      after(async () => {
        const identityRequest = buildIdentityRecordingRequest(
          request,
          fingerprintTrust.existingCookie?.trustedFingerprint ??
            fingerprintTrust.cookiePayloadToSet?.trustedFingerprint ??
            null,
        );
        await Promise.allSettled([
          recordSessionIdentity({
            convex,
            secret: mutationSecret,
            request: identityRequest,
            sessionId: result.sessionId as Id<"sessions">,
            github,
            level: result.level as 1 | 2 | 3,
            route: "/api/session",
            screen: "playing",
          }),
          recordSessionFingerprint({
            convex,
            secret: mutationSecret,
            sessionId: result.sessionId as Id<"sessions">,
            github,
            level: result.level as 1 | 2 | 3,
            route: "/api/session",
            screen: "playing",
            fingerprintSummary: trustedFingerprintSummary,
            sourceTrust: "server_derived_from_client_hints",
          }),
        ]);
      });

      const response = NextResponse.json(payload);
      if (fingerprintTrust.cookiePayloadToSet) {
        await applyTrustedFingerprintCookie(response, fingerprintTrust.cookiePayloadToSet);
      }
      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create session";
      const status = message.includes("rate limited")
        ? 429
        : message.includes("locked")
          ? 403
          : 500;
      console.error("/api/session error:", err);
      return NextResponse.json({ error: message }, { status });
    }
  });
}
