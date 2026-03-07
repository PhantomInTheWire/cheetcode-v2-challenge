import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

type InternalMutationRunner = (reference: unknown, args: Record<string, unknown>) => Promise<void>;

export const recordLinksInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    route: v.string(),
    screen: v.optional(v.string()),
    createdAt: v.number(),
    identities: v.array(
      v.object({
        key: v.string(),
        kind: v.union(v.literal("ip"), v.literal("fp")),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessionIdentityLinks")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const rowsByKey = new Map<string, typeof existing>();
    for (const row of existing) {
      const current = rowsByKey.get(row.identityKey) ?? [];
      current.push(row);
      rowsByKey.set(row.identityKey, current);
    }

    for (const identity of args.identities) {
      const matchingRows = rowsByKey.get(identity.key) ?? [];
      const current =
        matchingRows.sort(
          (a, b) => b.lastSeenAt - a.lastSeenAt || b._creationTime - a._creationTime,
        )[0] ?? null;

      if (current) {
        await ctx.db.patch(current._id, {
          github: args.github,
          level: args.level,
          route: args.route,
          screen: args.screen,
          lastSeenAt: args.createdAt,
        });
        for (const duplicate of matchingRows) {
          if (duplicate._id !== current._id) {
            await ctx.db.delete(duplicate._id);
          }
        }
      } else {
        await ctx.db.insert("sessionIdentityLinks", {
          sessionId: args.sessionId,
          github: args.github,
          level: args.level,
          identityKey: identity.key,
          identityKind: identity.kind,
          route: args.route,
          screen: args.screen,
          firstSeenAt: args.createdAt,
          lastSeenAt: args.createdAt,
        });
      }
    }
  },
});

export const recordLinks = action({
  args: {
    secret: v.string(),
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    route: v.string(),
    screen: v.optional(v.string()),
    createdAt: v.number(),
    identities: v.array(
      v.object({
        key: v.string(),
        kind: v.union(v.literal("ip"), v.literal("fp")),
      }),
    ),
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }

    const runMutation = ctx.runMutation as unknown as InternalMutationRunner;
    await runMutation(
      (internal as typeof internal & { sessionIdentity: { recordLinksInternal: unknown } })
        .sessionIdentity.recordLinksInternal,
      {
        sessionId: args.sessionId,
        github: args.github,
        level: args.level,
        route: args.route,
        screen: args.screen,
        createdAt: args.createdAt,
        identities: args.identities,
      },
    );
  },
});

export const getRecentLinks = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessionIdentityLinks")
      .withIndex("by_last_seen")
      .order("desc")
      .take(Math.max(1, Math.min(args.limit ?? 1200, 5000)));
  },
});
