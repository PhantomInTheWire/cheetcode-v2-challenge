import type { ConvexHttpClient } from "convex/browser";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { getIdentityDescriptors, type IdentityDescriptor } from "../abuse/identity";

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
    await input.convex.action(
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
    console.warn("[session-identity] best-effort task failed", error);
    return;
  }
}
