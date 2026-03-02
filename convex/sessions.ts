import { v } from "convex/values";
import { internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { selectSessionProblems, stripSolution, injectDescriptionCanary } from "../server/problems";
import { validateGithub } from "../src/lib/validation";
import { ROUND_DURATION_MS } from "./constants";
import { LEVEL2_PROBLEMS } from "../server/level2/problems";
import { generateLevel3Challenge } from "../server/level3/problems";

const SESSION_COOLDOWN_MS = 5_000;
export const ROUND_DURATION_L2_MS = 45_000;
export const ROUND_DURATION_L3_MS = 120_000;

export const createInternal = internalMutation({
  args: {
    github: v.string(),
    requestedLevel: v.optional(v.number()),
    isDev: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const ghResult = validateGithub(args.github);
    if (ghResult.ok === false) throw new Error(ghResult.error);
    const github = ghResult.value;

    // Rate limit
    const recent = await ctx.db
      .query("sessions")
      .withIndex("by_github", (q) => q.eq("github", github))
      .order("desc")
      .first();
    if (recent && Date.now() - recent.startedAt < SESSION_COOLDOWN_MS) {
      throw new Error("rate limited — wait a few seconds");
    }

    const leaderboard = await ctx.db
      .query("leaderboard")
      .withIndex("by_github", (q) => q.eq("github", github))
      .first();

    const unlockedLevel = leaderboard?.unlockedLevel ?? 1;
    let level = args.requestedLevel ?? unlockedLevel;
    if (!Number.isInteger(level) || level < 1 || level > 3) {
      throw new Error("invalid requested level");
    }

    // In dev mode (explicit flag from frontend), allow playing any level
    if (!args.isDev && level > unlockedLevel) {
      level = unlockedLevel;
    }

    const startedAt = Date.now();
    let expiresAt = startedAt + ROUND_DURATION_MS;
    let problemsToReturn: Record<string, unknown>[] = [];
    let problemIds: string[] = [];

    if (level === 2) {
      expiresAt = startedAt + ROUND_DURATION_L2_MS;
      problemIds = LEVEL2_PROBLEMS.map((p) => p.id);
      problemsToReturn = LEVEL2_PROBLEMS.map((p) => ({
        id: p.id,
        question: p.question,
      }));
    } else if (level === 3) {
      expiresAt = startedAt + ROUND_DURATION_L3_MS;
      const challenge = generateLevel3Challenge();
      problemIds = challenge.checks.map((c) => c.id);
      problemsToReturn = [
        {
          id: challenge.id,
          title: challenge.title,
          taskId: challenge.taskId,
          taskName: challenge.taskName,
          language: challenge.language,
          spec: challenge.spec,
          starterCode: challenge.starterCode,
          checks: challenge.checks.map((c) => ({
            id: c.id,
            name: c.name,
          })),
        },
      ];
    } else {
      const picked = selectSessionProblems();
      problemIds = picked.map((problem) => problem.id);
      problemsToReturn = injectDescriptionCanary(picked.map(stripSolution));
    }

    const sessionId = await ctx.db.insert("sessions", {
      github,
      problemIds,
      startedAt,
      expiresAt,
      level,
    });

    return {
      sessionId,
      startedAt,
      expiresAt,
      problems: problemsToReturn,
      level,
    };
  },
});

export const create = action({
  args: {
    secret: v.string(),
    github: v.string(),
    requestedLevel: v.optional(v.number()),
    isDev: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    sessionId: string;
    startedAt: number;
    expiresAt: number;
    problems: Record<string, unknown>[];
    level: number;
  }> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.runMutation(internal.sessions.createInternal, {
      github: args.github,
      requestedLevel: args.requestedLevel,
      isDev: args.isDev,
    });
  },
});
