import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import type { ServerVerifiedFingerprintSummary } from "../fingerprint/server-trust";

type ConvexActionReference = Parameters<ConvexHttpClient["action"]>[0];

type SessionFingerprintInput = {
  convex: ConvexHttpClient;
  secret: string;
  sessionId: Id<"sessions">;
  github: string;
  level: 1 | 2 | 3;
  route: string;
  screen?: string;
  fingerprintSummary?: ServerVerifiedFingerprintSummary;
  sourceTrust?: string;
};

export async function recordSessionFingerprint(input: SessionFingerprintInput): Promise<void> {
  if (!input.fingerprintSummary) return;

  try {
    const recordFingerprintProfile = (
      api as typeof api & {
        sessionIdentity: { recordFingerprintProfile: ConvexActionReference };
      }
    ).sessionIdentity.recordFingerprintProfile;
    await input.convex.action(recordFingerprintProfile, {
      secret: input.secret,
      sessionId: input.sessionId,
      github: input.github,
      level: input.level,
      route: input.route,
      screen: input.screen,
      createdAt: Date.now(),
      sourceTrust: input.sourceTrust ?? "server_derived",
      summaryJson: JSON.stringify(input.fingerprintSummary),
    });
  } catch (error) {
    void error;
    return;
  }
}
