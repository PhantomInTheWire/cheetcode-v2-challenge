import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { getIdentityDescriptors } from "./abuse/identity";

type SessionIdentityInput = {
  convex: ConvexHttpClient;
  secret: string;
  request: Request;
  sessionId: Id<"sessions">;
  github: string;
  level: 1 | 2 | 3;
  route: string;
  screen?: string;
};

type ConvexActionCaller = (reference: unknown, args: Record<string, unknown>) => Promise<unknown>;

export async function recordSessionIdentity(input: SessionIdentityInput): Promise<void> {
  const identities = getIdentityDescriptors(input.request);
  if (identities.length === 0) return;

  try {
    const callAction = input.convex.action as unknown as ConvexActionCaller;
    await callAction(
      (api as typeof api & { sessionIdentity: { recordLinks: unknown } }).sessionIdentity
        .recordLinks,
      {
        secret: input.secret,
        sessionId: input.sessionId,
        github: input.github,
        level: input.level,
        route: input.route,
        screen: input.screen,
        createdAt: Date.now(),
        identities,
      },
    );
  } catch (error) {
    console.error("[session-identity] failed to record links", error);
  }
}
