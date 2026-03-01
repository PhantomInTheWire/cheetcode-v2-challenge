import { query } from "./_generated/server";
import { sortByEloAndAttempts } from "./helpers";

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("leaderboard")
      .withIndex("by_elo")
      .order("desc")
      .collect();

    return sortByEloAndAttempts(entries);
  },
});