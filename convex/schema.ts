import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    github: v.string(),
    problemIds: v.array(v.string()),
    startedAt: v.number(),
    expiresAt: v.number(),
    level: v.optional(v.number()), // Default to 1 in code
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
});
