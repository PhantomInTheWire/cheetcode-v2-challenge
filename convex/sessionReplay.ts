import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

type InternalMutationRunner = (
  reference: unknown,
  args: Record<string, unknown>,
) => Promise<string>;

function parseJsonField(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
}

function resolveStatus(args: {
  eventType: string;
  createdAt: number;
  expiresAt: number;
  existingStatus?: string;
}) {
  if (args.eventType === "results_viewed") return "completed";
  if (args.existingStatus === "completed") return "completed";
  if (args.createdAt >= args.expiresAt) return "expired";
  return "active";
}

export const recordEventInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    eventType: v.string(),
    screen: v.string(),
    route: v.string(),
    createdAt: v.number(),
    clientAt: v.optional(v.number()),
    summaryJson: v.string(),
    snapshotJson: v.optional(v.string()),
    snapshotPreviewJson: v.optional(v.string()),
    snapshotHash: v.optional(v.string()),
    snapshotSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("session not found");
    }

    const existingPresence = await ctx.db
      .query("sessionReplayPresence")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const summary = parseJsonField(args.summaryJson);
    const expiresAt =
      typeof summary?.expiresAt === "number" && Number.isFinite(summary.expiresAt)
        ? summary.expiresAt
        : session.expiresAt;
    const duplicateOfPrevious =
      Boolean(args.snapshotHash) &&
      Boolean(existingPresence?.lastSnapshotHash) &&
      existingPresence?.lastSnapshotHash === args.snapshotHash;
    const sequence = (existingPresence?.eventCount ?? 0) + 1;

    const insertedId = await ctx.db.insert("sessionReplayEvents", {
      sessionId: args.sessionId,
      github: args.github,
      level: args.level,
      eventType: args.eventType,
      screen: args.screen,
      route: args.route,
      createdAt: args.createdAt,
      clientAt: args.clientAt,
      sequence,
      duplicateOfPrevious,
      snapshotHash: args.snapshotHash,
      snapshotSize: args.snapshotSize,
      summaryJson: args.summaryJson,
      snapshotJson: args.snapshotJson,
      snapshotPreviewJson: args.snapshotPreviewJson,
    });

    const status = resolveStatus({
      eventType: args.eventType,
      createdAt: args.createdAt,
      expiresAt,
      existingStatus: existingPresence?.status,
    });

    const presenceUpdate = {
      sessionId: args.sessionId,
      github: args.github,
      level: args.level,
      screen: args.screen,
      route: args.route,
      status,
      startedAt: session.startedAt,
      expiresAt,
      lastSeenAt: args.createdAt,
      lastEventAt: args.createdAt,
      lastEventType: args.eventType,
      eventCount: sequence,
      duplicateSnapshotCount:
        (existingPresence?.duplicateSnapshotCount ?? 0) + (duplicateOfPrevious ? 1 : 0),
      lastSnapshotHash: args.snapshotHash ?? existingPresence?.lastSnapshotHash,
      summaryJson: args.summaryJson,
      snapshotPreviewJson: args.snapshotPreviewJson,
      completedAt: status === "completed" ? args.createdAt : existingPresence?.completedAt,
    };

    if (existingPresence) {
      await ctx.db.patch(existingPresence._id, presenceUpdate);
    } else {
      await ctx.db.insert("sessionReplayPresence", presenceUpdate);
    }

    return insertedId;
  },
});

export const recordEvent = action({
  args: {
    secret: v.string(),
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    eventType: v.string(),
    screen: v.string(),
    route: v.string(),
    createdAt: v.number(),
    clientAt: v.optional(v.number()),
    summaryJson: v.string(),
    snapshotJson: v.optional(v.string()),
    snapshotPreviewJson: v.optional(v.string()),
    snapshotHash: v.optional(v.string()),
    snapshotSize: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    const runMutation = ctx.runMutation as unknown as InternalMutationRunner;
    return await runMutation(
      (internal as typeof internal & { sessionReplay: { recordEventInternal: unknown } })
        .sessionReplay.recordEventInternal,
      {
        sessionId: args.sessionId,
        github: args.github,
        level: args.level,
        eventType: args.eventType,
        screen: args.screen,
        route: args.route,
        createdAt: args.createdAt,
        clientAt: args.clientAt,
        summaryJson: args.summaryJson,
        snapshotJson: args.snapshotJson,
        snapshotPreviewJson: args.snapshotPreviewJson,
        snapshotHash: args.snapshotHash,
        snapshotSize: args.snapshotSize,
      },
    );
  },
});

export const getRecentSessions = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("sessionReplayPresence")
      .withIndex("by_last_seen")
      .order("desc")
      .take(Math.max(1, Math.min(args.limit ?? 30, 100)));

    return rows.map((row) => ({
      ...row,
      summary: parseJsonField(row.summaryJson),
      snapshotPreview: parseJsonField(row.snapshotPreviewJson),
      live: row.status === "active" && row.lastSeenAt >= Date.now() - 15_000,
    }));
  },
});

export const getSessionReplay = query({
  args: {
    sessionId: v.id("sessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const [session, presence, replayEvents, attemptEvents] = await Promise.all([
      ctx.db.get(args.sessionId),
      ctx.db
        .query("sessionReplayPresence")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .first(),
      ctx.db
        .query("sessionReplayEvents")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .order("desc")
        .take(Math.max(1, Math.min(args.limit ?? 160, 400))),
      ctx.db
        .query("attemptTelemetry")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .order("asc")
        .collect(),
    ]);

    return {
      session,
      presence: presence
        ? {
            ...presence,
            summary: parseJsonField(presence.summaryJson),
            snapshotPreview: parseJsonField(presence.snapshotPreviewJson),
          }
        : null,
      replayEvents: replayEvents.reverse().map((event) => ({
        ...event,
        summary: parseJsonField(event.summaryJson),
        snapshot: parseJsonField(event.snapshotJson),
        snapshotPreview: parseJsonField(event.snapshotPreviewJson),
      })),
      attemptEvents: attemptEvents.map((event) => ({
        ...event,
        summary: parseJsonField(event.summaryJson),
      })),
    };
  },
});
