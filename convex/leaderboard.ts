import { v } from "convex/values";
import { query } from "./_generated/server";
import { calculateRank, sortByEloAndAttempts } from "./helpers";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("leaderboard").withIndex("by_elo").order("desc").collect();

    return sortByEloAndAttempts(records)
      .slice(0, 100)
      .map((r) => ({
        github: r.github,
        solved: r.solved,
        timeSecs: r.timeSecs,
        elo: r.elo,
        attempts: r.attempts,
      }));
  },
});

export const getMyLevel = query({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("leaderboard")
      .withIndex("by_github", (q) => q.eq("github", args.github))
      .first();
    return record?.unlockedLevel ?? 1;
  },
});

export const getPlayerSnapshot = query({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("leaderboard")
      .withIndex("by_github", (q) => q.eq("github", args.github))
      .first();
    if (!record) return null;

    const records = await ctx.db.query("leaderboard").withIndex("by_elo").order("desc").take(100);
    const sorted = sortByEloAndAttempts(records);
    const rank = calculateRank(sorted, record.elo, record.attempts ?? 1);

    return {
      elo: record.elo,
      solved: record.solved,
      rank,
    };
  },
});
