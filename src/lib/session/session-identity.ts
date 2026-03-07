import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { getIdentityDescriptors, type IdentityDescriptor } from "../abuse/identity";

type ConvexActionReference = Parameters<ConvexHttpClient["action"]>[0];

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

export async function recordSessionIdentity(input: SessionIdentityInput): Promise<void> {
  const identities: IdentityDescriptor[] = getIdentityDescriptors(input.request);
  if (identities.length === 0) return;

  try {
    const recordLinks = (
      api as typeof api & { sessionIdentity: { recordLinks: ConvexActionReference } }
    ).sessionIdentity.recordLinks;
    await input.convex.action(recordLinks, {
      secret: input.secret,
      sessionId: input.sessionId,
      github: input.github,
      level: input.level,
      route: input.route,
      screen: input.screen,
      createdAt: Date.now(),
      identities,
    });
  } catch (error) {
    void error;
    return;
  }
}
