import { v } from "convex/values";
import { query } from "./_generated/server";
import { sortByEloAndAttempts } from "./helpers";

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
