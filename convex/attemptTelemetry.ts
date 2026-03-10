import { v } from "convex/values";
import { action, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";

function parseJsonField(value: string | undefined) {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return { raw: value };
  }
}

function suspiciousSessionFromRollup(rollup: {
  duplicateArtifacts: number;
  totalEvents: number;
  shadowBannedEvents: number;
  infraErrorEvents: number;
  improvedEvents: number;
}) {
  const duplicateRateBps =
    rollup.totalEvents > 0
      ? Math.round((rollup.duplicateArtifacts * 10_000) / rollup.totalEvents)
      : 0;
  return (
    duplicateRateBps >= 5000 ||
    rollup.shadowBannedEvents > 0 ||
    (rollup.totalEvents >= 4 && rollup.improvedEvents === 0 && rollup.infraErrorEvents === 0)
  );
}

export const recordEventInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    eventType: v.string(),
    createdAt: v.number(),
    elapsedMs: v.optional(v.number()),
    route: v.string(),
    status: v.string(),
    errorType: v.optional(v.string()),
    solvedCount: v.optional(v.number()),
    passCount: v.optional(v.number()),
    failCount: v.optional(v.number()),
    artifactHash: v.optional(v.string()),
    artifactSize: v.optional(v.number()),
    summaryJson: v.string(),
    artifactJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attemptTelemetry")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const previous = existing.at(-1);
    const previousPassCount = previous?.passCount ?? 0;
    const nextPassCount = args.passCount ?? 0;
    const passDelta = nextPassCount - previousPassCount;
    const duplicateOfPrevious =
      Boolean(args.artifactHash) &&
      Boolean(previous?.artifactHash) &&
      args.artifactHash === previous?.artifactHash;
    const improvedFromPrevious = passDelta > 0;
    const firstFullPass =
      nextPassCount > 0 && args.failCount === 0 && !existing.some((row) => row.firstFullPass);

    let artifactId;
    if (args.artifactJson && args.artifactHash && args.artifactSize !== undefined) {
      const existingArtifact = await ctx.db
        .query("attemptArtifacts")
        .withIndex("by_hash", (q) => q.eq("artifactHash", args.artifactHash!))
        .first();
      artifactId =
        existingArtifact?._id ??
        (await ctx.db.insert("attemptArtifacts", {
          sessionId: args.sessionId,
          github: args.github,
          eventType: args.eventType,
          createdAt: args.createdAt,
          artifactHash: args.artifactHash,
          artifactSize: args.artifactSize,
          payloadJson: args.artifactJson,
        }));
    }

    const rollup = await ctx.db
      .query("sessionTelemetryRollups")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const isValidate = args.eventType.startsWith("validate_");
    const isFinish = args.eventType.startsWith("finish_");
    const usedValidationBeforeFinish =
      rollup?.usedValidationBeforeFinish === true ||
      (isFinish && (rollup?.validateEvents ?? 0) > 0);

    const insertedId = await ctx.db.insert("attemptTelemetry", {
      sessionId: args.sessionId,
      github: args.github,
      level: args.level,
      eventType: args.eventType,
      createdAt: args.createdAt,
      attemptIndex: existing.length + 1,
      elapsedMs: args.elapsedMs,
      route: args.route,
      status: args.status,
      errorType: args.errorType,
      solvedCount: args.solvedCount,
      passCount: args.passCount,
      failCount: args.failCount,
      artifactHash: args.artifactHash,
      artifactSize: args.artifactSize,
      improvedFromPrevious,
      duplicateOfPrevious,
      passDelta,
      usedValidationBeforeFinish,
      firstFullPass,
      artifactId,
      summaryJson: args.summaryJson,
    });

    const totalEvents = (rollup?.totalEvents ?? 0) + 1;
    const duplicateArtifacts = (rollup?.duplicateArtifacts ?? 0) + (duplicateOfPrevious ? 1 : 0);
    const improvedEvents = (rollup?.improvedEvents ?? 0) + (improvedFromPrevious ? 1 : 0);
    const totalPassDelta = (rollup?.totalPassDelta ?? 0) + passDelta;
    const finishEvents = (rollup?.finishEvents ?? 0) + (isFinish ? 1 : 0);
    const validateEvents = (rollup?.validateEvents ?? 0) + (isValidate ? 1 : 0);
    const nextRollup = {
      sessionId: args.sessionId,
      github: args.github,
      level: args.level,
      totalEvents,
      validateEvents,
      finishEvents,
      passedEvents: (rollup?.passedEvents ?? 0) + (args.status === "passed" ? 1 : 0),
      failedEvents: (rollup?.failedEvents ?? 0) + (args.status === "failed" ? 1 : 0),
      partialEvents: (rollup?.partialEvents ?? 0) + (args.status === "partial" ? 1 : 0),
      infraErrorEvents: (rollup?.infraErrorEvents ?? 0) + (args.status === "infra_error" ? 1 : 0),
      shadowBannedEvents:
        (rollup?.shadowBannedEvents ?? 0) + (args.status === "shadow_banned" ? 1 : 0),
      duplicateArtifacts,
      improvedEvents,
      lastEventAt: args.createdAt,
      firstEventAt: rollup?.firstEventAt ?? args.createdAt,
      maxPassCount: Math.max(rollup?.maxPassCount ?? 0, nextPassCount),
      lastPassCount: nextPassCount,
      usedValidationBeforeFinish,
      averagePassDelta: totalEvents > 0 ? totalPassDelta / totalEvents : 0,
      totalPassDelta,
      duplicateArtifactRateBps:
        totalEvents > 0 ? Math.round((duplicateArtifacts * 10_000) / totalEvents) : 0,
      improvementRateBps: totalEvents > 0 ? Math.round((improvedEvents * 10_000) / totalEvents) : 0,
      validatedFinishes:
        (rollup?.validatedFinishes ?? 0) + (isFinish && usedValidationBeforeFinish ? 1 : 0),
      suspiciousSession: false,
      lastEventType: args.eventType,
      lastStatus: args.status,
    };
    nextRollup.suspiciousSession = suspiciousSessionFromRollup(nextRollup);

    if (rollup) {
      await ctx.db.patch(rollup._id, nextRollup);
    } else {
      await ctx.db.insert("sessionTelemetryRollups", nextRollup);
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
    createdAt: v.number(),
    elapsedMs: v.optional(v.number()),
    route: v.string(),
    status: v.string(),
    errorType: v.optional(v.string()),
    solvedCount: v.optional(v.number()),
    passCount: v.optional(v.number()),
    failCount: v.optional(v.number()),
    artifactHash: v.optional(v.string()),
    artifactSize: v.optional(v.number()),
    summaryJson: v.string(),
    artifactJson: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }

    const session = await ctx.runQuery(api.sessions.getSession, {
      secret: args.secret,
      sessionId: args.sessionId,
    });
    if (!session) {
      throw new Error("session not found");
    }
    if (session.github !== args.github) {
      throw new Error("github mismatch");
    }

    return await ctx.runMutation(internal.attemptTelemetry.recordEventInternal, {
      sessionId: args.sessionId,
      github: args.github,
      level: args.level,
      eventType: args.eventType,
      createdAt: args.createdAt,
      elapsedMs: args.elapsedMs,
      route: args.route,
      status: args.status,
      errorType: args.errorType,
      solvedCount: args.solvedCount,
      passCount: args.passCount,
      failCount: args.failCount,
      artifactHash: args.artifactHash,
      artifactSize: args.artifactSize,
      summaryJson: args.summaryJson,
      artifactJson: args.artifactJson,
    });
  },
});

export const getSessionTimeline = query({
  args: { secret: v.string(), sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    const session = await ctx.db.get(args.sessionId);
    const rollup = await ctx.db
      .query("sessionTelemetryRollups")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    const artifacts = await ctx.db
      .query("attemptArtifacts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const artifactsById = new Map(artifacts.map((artifact) => [artifact._id, artifact]));
    const events = await ctx.db
      .query("attemptTelemetry")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();

    return {
      session,
      rollup,
      events: events.map((event) => ({
        ...event,
        summary: parseJsonField(event.summaryJson),
        artifact: event.artifactId
          ? parseJsonField(artifactsById.get(event.artifactId)?.payloadJson)
          : null,
      })),
    };
  },
});

export const getGithubTelemetry = query({
  args: {
    secret: v.string(),
    github: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    const rows = await ctx.db
      .query("attemptTelemetry")
      .withIndex("by_github", (q) => q.eq("github", args.github))
      .order("desc")
      .take(Math.max(1, Math.min(args.limit ?? 50, 200)));

    return rows.map((event) => ({
      ...event,
      summary: parseJsonField(event.summaryJson),
    }));
  },
});

export const getSessionRollup = query({
  args: { secret: v.string(), sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.db
      .query("sessionTelemetryRollups")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
  },
});

export const getFlaggedSessions = query({
  args: {
    secret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    const rows = await ctx.db.query("sessionTelemetryRollups").collect();
    return rows
      .filter(
        (row) => row.suspiciousSession || row.shadowBannedEvents > 0 || row.duplicateArtifacts > 0,
      )
      .sort((a, b) => b.lastEventAt - a.lastEventAt)
      .slice(0, Math.max(1, Math.min(args.limit ?? 50, 200)));
  },
});

export const getSessionsWithLandmines = query({
  args: {
    secret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    const rows = await ctx.db.query("attemptTelemetry").collect();
    return rows
      .filter((row) => {
        const summary = parseJsonField(row.summaryJson);
        const landmineIds = Array.isArray(summary?.landmineIds) ? summary.landmineIds : [];
        return landmineIds.length > 0;
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(1, Math.min(args.limit ?? 50, 200)))
      .map((row) => ({
        ...row,
        summary: parseJsonField(row.summaryJson),
      }));
  },
});

export const getSessionsNeedingReview = query({
  args: {
    secret: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    const rows = await ctx.db.query("sessionTelemetryRollups").collect();
    return rows
      .filter(
        (row) =>
          row.suspiciousSession ||
          row.improvementRateBps === 0 ||
          row.usedValidationBeforeFinish === false,
      )
      .sort((a, b) => b.lastEventAt - a.lastEventAt)
      .slice(0, Math.max(1, Math.min(args.limit ?? 50, 200)));
  },
});
