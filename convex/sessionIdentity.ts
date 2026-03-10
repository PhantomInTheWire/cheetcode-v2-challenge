import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

type InternalMutationRunner = (reference: unknown, args: Record<string, unknown>) => Promise<void>;

function parseJsonField(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
}

type ParsedFingerprintSummary = {
  fingerprintId?: string;
  fingerprintSource?: string;
  automationVerdict?: string;
  automationConfidence?: string;
};

function parseFingerprintSummary(summaryJson: string): ParsedFingerprintSummary {
  const summary = parseJsonField(summaryJson) ?? {};
  const automation =
    summary.automation && typeof summary.automation === "object" ? summary.automation : {};

  const readString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

  return {
    fingerprintId: readString(summary.fingerprintId),
    fingerprintSource: readString(summary.fingerprintSource),
    automationVerdict: readString((automation as Record<string, unknown>).automationVerdict),
    automationConfidence: readString((automation as Record<string, unknown>).automationConfidence),
  };
}

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

export const upsertFingerprintProfileInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    route: v.string(),
    screen: v.optional(v.string()),
    createdAt: v.number(),
    sourceTrust: v.string(),
    summaryJson: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("sessionFingerprintProfiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existing =
      rows.sort((a, b) => b.lastSeenAt - a.lastSeenAt || b._creationTime - a._creationTime)[0] ??
      null;
    const nextSummary = parseFingerprintSummary(args.summaryJson);
    const update = {
      sessionId: args.sessionId,
      github: args.github,
      level: args.level,
      sourceTrust: args.sourceTrust,
      fingerprintId: nextSummary.fingerprintId ?? existing?.fingerprintId,
      fingerprintSource: nextSummary.fingerprintSource ?? existing?.fingerprintSource,
      automationVerdict: nextSummary.automationVerdict ?? existing?.automationVerdict,
      automationConfidence: nextSummary.automationConfidence ?? existing?.automationConfidence,
      profileHash: undefined,
      environmentHash: undefined,
      displayHash: undefined,
      renderingHash: undefined,
      deviceClusterKey: undefined,
      localeClusterKey: undefined,
      baselineSummaryJson: existing?.baselineSummaryJson ?? args.summaryJson,
      latestSummaryJson: args.summaryJson,
      driftFlagsJson: JSON.stringify({}),
      firstSeenAt: existing?.firstSeenAt ?? args.createdAt,
      lastSeenAt: args.createdAt,
      changeCount: existing?.changeCount ?? 0,
      lastRoute: args.route,
      lastScreen: args.screen,
    };

    if (existing) {
      await ctx.db.patch(existing._id, update);
      for (const duplicate of rows) {
        if (duplicate._id !== existing._id) {
          await ctx.db.delete(duplicate._id);
        }
      }
      return;
    }

    await ctx.db.insert("sessionFingerprintProfiles", update);
  },
});

export const recordFingerprintProfile = action({
  args: {
    secret: v.string(),
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    route: v.string(),
    screen: v.optional(v.string()),
    createdAt: v.number(),
    sourceTrust: v.string(),
    summaryJson: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }

    const runMutation = ctx.runMutation as unknown as InternalMutationRunner;
    await runMutation(
      (
        internal as typeof internal & {
          sessionIdentity: { upsertFingerprintProfileInternal: unknown };
        }
      ).sessionIdentity.upsertFingerprintProfileInternal,
      {
        sessionId: args.sessionId,
        github: args.github,
        level: args.level,
        route: args.route,
        screen: args.screen,
        createdAt: args.createdAt,
        sourceTrust: args.sourceTrust,
        summaryJson: args.summaryJson,
      },
    );
  },
});

export const getRecentLinks = query({
  args: {
    secret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.db
      .query("sessionIdentityLinks")
      .withIndex("by_last_seen")
      .order("desc")
      .take(Math.max(1, Math.min(args.limit ?? 1200, 5000)));
  },
});

export const getSessionFingerprintProfile = query({
  args: {
    secret: v.string(),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }

    const row = await ctx.db
      .query("sessionFingerprintProfiles")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!row) return null;

    return {
      ...row,
      baselineSummary: parseJsonField(row.baselineSummaryJson),
      latestSummary: parseJsonField(row.latestSummaryJson),
      driftFlags: parseJsonField(row.driftFlagsJson),
    };
  },
});
