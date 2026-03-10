import { v } from "convex/values";
import { internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { PROBLEM_BANK } from "../server/level1/problems";
import { computeElo, getDifficultyBonus } from "../src/lib/scoring";
import { ROUND_DURATION_MS } from "../src/lib/constants";
import { sortByEloAndAttempts, calculateRank } from "./helpers";
import { ROUND_DURATION_L2_MS, ROUND_DURATION_L3_MS } from "./sessions";

const EXPLOIT_BONUS_CAP = 1000;

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

    if (args.github !== session.github) {
      throw new Error("github mismatch");
    }

    const sessionProblemSet = new Set(session.problemIds);
    const uniqueSolvedIds = new Set(args.solvedProblemIds);
    const validSolvedIds = [...uniqueSolvedIds].filter((id) => sessionProblemSet.has(id));

    const cappedExploitBonus = Math.max(
      -EXPLOIT_BONUS_CAP,
      Math.min(EXPLOIT_BONUS_CAP, args.exploitBonus ?? 0),
    );

    const level = session.level ?? 1;
    const maxTime =
      level === 2 ? ROUND_DURATION_L2_MS : level === 3 ? ROUND_DURATION_L3_MS : ROUND_DURATION_MS;
    const clampedTime = Math.max(0, Math.min(maxTime, args.timeElapsedMs));
    const finishedAt = Date.now();

    const solvedCount = validSolvedIds.length;
    const timeRemainingSecs = Math.max(0, Math.floor((maxTime - clampedTime) / 1000));
    const runTimeSecs = Math.floor(clampedTime / 1000);

    let elo = 0;

    if (level === 1) {
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
      elo = baseElo + cappedExploitBonus;
    } else if (level === 2) {
      // Level 2 scoring: flat 150 points per problem solved + time bonus
      const baseElo = solvedCount * 150;
      const timeBonus = solvedCount > 0 ? timeRemainingSecs * 5 : 0;
      elo = baseElo + timeBonus + cappedExploitBonus;
    } else if (level === 3) {
      // Level 3 scoring: higher value per solved checkpoint
      const baseElo = solvedCount * 300;
      const timeBonus = solvedCount > 0 ? timeRemainingSecs * 2 : 0;
      elo = baseElo + timeBonus + cappedExploitBonus;
    }

    const existing = await ctx.db
      .query("leaderboard")
      .withIndex("by_github", (q) => q.eq("github", args.github))
      .first();
    const nextAttempts = existing?.attempts === undefined ? 1 : existing.attempts + 1;

    if (!existing && solvedCount === 0 && elo <= 0) {
      return { elo: 0, solved: 0, rank: 0, timeRemaining: timeRemainingSecs };
    }

    let currentL1Solved = existing?.level1BestSolved ?? 0;
    let currentL1Elo = existing?.level1BestElo ?? 0;
    let currentL2Solved = existing?.level2BestSolved ?? 0;
    let currentL2Elo = existing?.level2BestElo ?? 0;
    let currentL3Solved = existing?.level3BestSolved ?? 0;
    let currentL3Elo = existing?.level3BestElo ?? 0;
    let unlockedLevel = existing?.unlockedLevel ?? 1;

    let shouldUpdateBests = false;

    if (level === 1) {
      if (elo > currentL1Elo) {
        currentL1Elo = elo;
        currentL1Solved = solvedCount;
        shouldUpdateBests = true;
      }
      if (solvedCount === 25) {
        unlockedLevel = Math.max(unlockedLevel, 2);
        shouldUpdateBests = true;
      }
    } else if (level === 2) {
      if (elo > currentL2Elo) {
        currentL2Elo = elo;
        currentL2Solved = solvedCount;
        shouldUpdateBests = true;
      }
      if (solvedCount === 10) {
        unlockedLevel = Math.max(unlockedLevel, 3);
        shouldUpdateBests = true;
      }
    } else if (level === 3) {
      if (elo > currentL3Elo) {
        currentL3Elo = elo;
        currentL3Solved = solvedCount;
        shouldUpdateBests = true;
      }
    }

    const totalSolved = currentL1Solved + currentL2Solved + currentL3Solved;
    const totalElo = currentL1Elo + currentL2Elo + currentL3Elo;

    if (!existing) {
      if (solvedCount > 0 || elo > 0) {
        await ctx.db.insert("leaderboard", {
          github: args.github,
          solved: totalSolved,
          timeSecs: runTimeSecs,
          elo: totalElo,
          sessionId: args.sessionId,
          attempts: 1,
          unlockedLevel,
          level1BestSolved: currentL1Solved,
          level1BestElo: currentL1Elo,
          level2BestSolved: currentL2Solved,
          level2BestElo: currentL2Elo,
          level3BestSolved: currentL3Solved,
          level3BestElo: currentL3Elo,
        });
      }
    } else {
      const updates: Record<string, unknown> = { attempts: nextAttempts };

      if (shouldUpdateBests) {
        Object.assign(updates, {
          solved: totalSolved,
          timeSecs: Math.min(existing.timeSecs ?? runTimeSecs, runTimeSecs),
          elo: totalElo,
          sessionId: args.sessionId,
          unlockedLevel,
          level1BestSolved: currentL1Solved,
          level1BestElo: currentL1Elo,
          level2BestSolved: currentL2Solved,
          level2BestElo: currentL2Elo,
          level3BestSolved: currentL3Solved,
          level3BestElo: currentL3Elo,
        });
      } else if (unlockedLevel > (existing.unlockedLevel ?? 1)) {
        updates.unlockedLevel = unlockedLevel;
      }

      await ctx.db.patch(existing._id, updates);
    }

    const top = await ctx.db.query("leaderboard").withIndex("by_elo").order("desc").take(100);
    const sorted = sortByEloAndAttempts(top);
    const userAttempts = nextAttempts;
    // calculateRank needs to check the totalElo against sorted list
    const rank = calculateRank(sorted, totalElo, userAttempts);

    if (session.expiresAt > finishedAt) {
      await ctx.db.patch(args.sessionId, { expiresAt: finishedAt });
    }

    return { elo: totalElo, solved: totalSolved, rank, timeRemaining: timeRemainingSecs };
  },
});

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
    return await ctx.runMutation(internal.submissions.recordResultsInternal, {
      sessionId: args.sessionId,
      github: args.github,
      solvedProblemIds: args.solvedProblemIds,
      timeElapsedMs: args.timeElapsedMs,
      exploitBonus: args.exploitBonus,
    });
  },
});
