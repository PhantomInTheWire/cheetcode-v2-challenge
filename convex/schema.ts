import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    github: v.string(),
    problemIds: v.array(v.string()),
    startedAt: v.number(),
    expiresAt: v.number(),
    level: v.optional(v.number()), // Default to 1 in code
    publicPayloadJson: v.optional(v.string()),
    level1CanaryProblemId: v.optional(v.string()),
  }).index("by_github", ["github"]),

  leaderboard: defineTable({
    github: v.string(),
    solved: v.number(),
    timeSecs: v.number(),
    elo: v.number(),
    sessionId: v.id("sessions"),
    attempts: v.optional(v.number()),
    unlockedLevel: v.optional(v.number()),
    level1BestSolved: v.optional(v.number()),
    level1BestElo: v.optional(v.number()),
    level2BestSolved: v.optional(v.number()),
    level2BestElo: v.optional(v.number()),
    level3BestSolved: v.optional(v.number()),
    level3BestElo: v.optional(v.number()),
  })
    .index("by_elo", ["elo"])
    .index("by_github", ["github"]),

  leads: defineTable({
    github: v.string(),
    email: v.string(),
    xHandle: v.optional(v.string()),
    flag: v.optional(v.string()),
    elo: v.number(),
    solved: v.number(),
    sessionId: v.id("sessions"),
  })
    .index("by_github", ["github"])
    .index("by_elo", ["elo"]),

  attemptTelemetry: defineTable({
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    eventType: v.string(),
    createdAt: v.number(),
    attemptIndex: v.number(),
    elapsedMs: v.optional(v.number()),
    route: v.string(),
    status: v.string(),
    errorType: v.optional(v.string()),
    solvedCount: v.optional(v.number()),
    passCount: v.optional(v.number()),
    failCount: v.optional(v.number()),
    artifactHash: v.optional(v.string()),
    artifactSize: v.optional(v.number()),
    improvedFromPrevious: v.optional(v.boolean()),
    duplicateOfPrevious: v.optional(v.boolean()),
    passDelta: v.optional(v.number()),
    usedValidationBeforeFinish: v.optional(v.boolean()),
    firstFullPass: v.optional(v.boolean()),
    artifactId: v.optional(v.id("attemptArtifacts")),
    summaryJson: v.string(),
  })
    .index("by_session", ["sessionId", "createdAt"])
    .index("by_github", ["github", "createdAt"])
    .index("by_status", ["status", "createdAt"]),

  attemptArtifacts: defineTable({
    sessionId: v.id("sessions"),
    github: v.string(),
    eventType: v.string(),
    createdAt: v.number(),
    artifactHash: v.string(),
    artifactSize: v.number(),
    payloadJson: v.string(),
  })
    .index("by_session", ["sessionId", "createdAt"])
    .index("by_hash", ["artifactHash"]),

  sessionTelemetryRollups: defineTable({
    sessionId: v.id("sessions"),
    github: v.string(),
    level: v.number(),
    totalEvents: v.number(),
    validateEvents: v.number(),
    finishEvents: v.number(),
    passedEvents: v.number(),
    failedEvents: v.number(),
    partialEvents: v.number(),
    infraErrorEvents: v.number(),
    shadowBannedEvents: v.number(),
    duplicateArtifacts: v.number(),
    improvedEvents: v.number(),
    lastEventAt: v.number(),
    maxPassCount: v.number(),
    lastPassCount: v.number(),
    usedValidationBeforeFinish: v.boolean(),
    firstEventAt: v.number(),
    averagePassDelta: v.number(),
    totalPassDelta: v.number(),
    duplicateArtifactRateBps: v.number(),
    improvementRateBps: v.number(),
    validatedFinishes: v.number(),
    suspiciousSession: v.boolean(),
    lastEventType: v.string(),
    lastStatus: v.string(),
  }).index("by_session", ["sessionId"]),
});
