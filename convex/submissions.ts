import { v } from "convex/values";
import { internalMutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { PROBLEM_BANK } from "../server/problems";
import { computeElo, getDifficultyBonus } from "../src/lib/scoring";

const EXPLOIT_BONUS_CAP = 1000;

/**
 * recordResultsInternal — internal mutation only callable from Convex actions.
 * Validates all inputs server-side regardless of what the caller sends.
 */
export const recordResultsInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    github: v.string(),
    solvedProblemIds: v.array(v.string()),
    timeElapsedMs: v.number(),
    exploitBonus: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("session not found");

    // Defense-in-depth: github must match the session owner
    if (args.github !== session.github) {
      throw new Error("github mismatch");
    }

    // Only accept problem IDs that were actually assigned to this session
    const sessionProblemSet = new Set(session.problemIds);
    const validSolvedIds = args.solvedProblemIds.filter((id) =>
      sessionProblemSet.has(id),
    );

    // Cap exploitBonus at the mutation layer too
    const cappedExploitBonus = Math.max(
      -EXPLOIT_BONUS_CAP,
      Math.min(EXPLOIT_BONUS_CAP, args.exploitBonus ?? 0),
    );

    const clampedTime = Math.max(0, Math.min(45_000, args.timeElapsedMs));

    const solvedCount = validSolvedIds.length;
    const timeRemainingSecs = Math.max(
      0,
      45 - Math.floor(clampedTime / 1000),
    );

    const solvedSet = new Set(validSolvedIds);
    const difficultyBonus = getDifficultyBonus(
      PROBLEM_BANK.filter((p) => solvedSet.has(p.id)).map((p) => ({
        solved: true,
        difficulty: p.tier,
      })),
    );

    const baseElo = computeElo({
      solvedCount,
      timeRemainingSecs,
      difficultyBonus,
    });
    const elo = baseElo + cappedExploitBonus;

    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_github", (q) => q.eq("github", args.github))
      .first();

    // Anti-grief: reject zero-value submissions that would only inflate attempts
    if (!existing && solvedCount === 0 && elo <= 0) {
      return { elo: 0, solved: 0, rank: 0, timeRemaining: timeRemainingSecs };
    }

    if (!existing) {
      if (solvedCount > 0 || elo > 0) {
        await ctx.db.insert("leaderboard", {
          github: args.github,
          solved: solvedCount,
          timeSecs: Math.floor(clampedTime / 1000),
          elo,
          sessionId: args.sessionId,
          attempts: 1,
        });
      }
    } else {
      const updates: Record<string, unknown> = {};

      // Only count attempts with actual effort
      if (solvedCount > 0 || elo > 0) {
        updates.attempts = (existing.attempts ?? 1) + 1;
      }

      if (elo > existing.elo) {
        Object.assign(updates, {
          solved: solvedCount,
          timeSecs: Math.floor(clampedTime / 1000),
          elo,
          sessionId: args.sessionId,
        });
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
    }

    // Compute rank
    const top = await ctx.db
      .query("leaderboard")
      .withIndex("by_elo")
      .order("desc")
      .take(100);
    const sorted = top.sort((a, b) => {
      if (b.elo !== a.elo) return b.elo - a.elo;
      return (a.attempts ?? 1) - (b.attempts ?? 1);
    });
    const userAttempts = (existing?.attempts ?? 0) + 1;
    const rankIdx = sorted.findIndex(
      (row) =>
        row.elo < elo ||
        (row.elo === elo && (row.attempts ?? 1) > userAttempts),
    );
    const rank = rankIdx === -1 ? sorted.length + 1 : rankIdx + 1;

    return { elo, solved: solvedCount, rank, timeRemaining: timeRemainingSecs };
  },
});

/** Authenticated gateway — only the Next.js server can call this */
export const recordResults = action({
  args: {
    secret: v.string(),
    sessionId: v.id("sessions"),
    github: v.string(),
    solvedProblemIds: v.array(v.string()),
    timeElapsedMs: v.number(),
    exploitBonus: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ elo: number; solved: number; rank: number; timeRemaining: number }> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    const { secret: _, ...mutationArgs } = args;
    return await ctx.runMutation(
      internal.submissions.recordResultsInternal,
      mutationArgs,
    );
  },
});

export const getSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});
