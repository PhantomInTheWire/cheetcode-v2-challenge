import { v } from "convex/values";
import { internalMutation, action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import { calculateRank, sortByEloAndAttempts } from "./helpers";
import {
  PROBLEM_BANK,
  selectSessionProblems,
  stripSolution,
  injectDescriptionCanary,
  injectDescriptionCanaryAtProblemId,
} from "../server/level1/problems";
import {
  type Level3ChallengeMeta,
  generateLevel3ChallengeMeta,
  getLevel3ChallengeMetaFromId,
} from "../server/level3/catalog";
import { validateGithub } from "../src/lib/validation";
import { ROUND_DURATION_MS } from "../src/lib/constants";
import { isServerDevMode } from "../src/lib/myEnv";
import { selectLevel2SessionProblems } from "../server/level2/problems";

export const ROUND_DURATION_L2_MS = 60_000;
export const ROUND_DURATION_L3_MS = 120_000;
export const MAX_SESSION_PAUSE_EXTENSION_MS = 30_000;

export function clampSessionPauseExtension(extendMs: number): number {
  return Math.max(0, Math.min(MAX_SESSION_PAUSE_EXTENSION_MS, Math.floor(extendMs)));
}

function parsePublicPayloadJson(payload: string | undefined): Record<string, unknown>[] {
  if (!payload) return [];
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

async function getScoreSnapshot(
  ctx: MutationCtx,
  github: string,
): Promise<{ elo: number; solved: number; rank: number } | null> {
  const record = await ctx.db
    .query("leaderboard")
    .withIndex("by_github", (q) => q.eq("github", github))
    .first();
  if (!record) return null;

  const records = await ctx.db.query("leaderboard").withIndex("by_elo").order("desc").take(100);
  const sorted = sortByEloAndAttempts(records);
  return {
    elo: record.elo,
    solved: record.solved,
    rank: calculateRank(sorted, record.elo, record.attempts ?? 1),
  };
}

export const createInternal = internalMutation({
  args: {
    github: v.string(),
    requestedLevel: v.optional(v.number()),
    requestedLevel3ChallengeId: v.optional(v.string()),
    requestedLevel2Projects: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const ghResult = validateGithub(args.github);
    if (ghResult.ok === false) throw new Error(ghResult.error);
    const github = ghResult.value;

    const leaderboard = await ctx.db
      .query("leaderboard")
      .withIndex("by_github", (q) => q.eq("github", github))
      .first();

    const unlockedLevel = leaderboard?.unlockedLevel ?? 1;
    const level = args.requestedLevel ?? unlockedLevel;
    if (!Number.isInteger(level) || level < 1 || level > 3) {
      throw new Error("invalid requested level");
    }

    // In dev mode, allow playing any level for local/testing workflows.
    if (!isServerDevMode() && level > unlockedLevel) {
      throw new Error(`level ${level} is locked`);
    }

    const recent = await ctx.db
      .query("sessions")
      .withIndex("by_github", (q) => q.eq("github", github))
      .order("desc")
      .first();
    const recentLevel = recent?.level ?? 1;

    // Reuse an active session only for the same level. Otherwise progression
    // gets stuck by resurrecting the previous round instead of launching the
    // requested one.
    if (recent && recent.expiresAt > Date.now() && recentLevel === level) {
      let restoredProblems: Record<string, unknown>[] = [];
      if (recentLevel === 1) {
        const byId = new Map(PROBLEM_BANK.map((problem) => [problem.id, problem]));
        const baseProblems = recent.problemIds
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((problem) => stripSolution(problem!));
        restoredProblems = recent.level1CanaryProblemId
          ? injectDescriptionCanaryAtProblemId(baseProblems, recent.level1CanaryProblemId)
          : injectDescriptionCanary(baseProblems);
      } else {
        restoredProblems = parsePublicPayloadJson(recent.publicPayloadJson);
      }
      return {
        sessionId: recent._id,
        startedAt: recent.startedAt,
        expiresAt: recent.expiresAt,
        problems: restoredProblems,
        level: recentLevel,
        scoreSnapshot: await getScoreSnapshot(ctx, github),
      };
    }
    const startedAt = Date.now();
    let expiresAt = startedAt + ROUND_DURATION_MS;
    let problemsToReturn: Record<string, unknown>[] = [];
    let problemIds: string[] = [];
    let publicPayloadJson: string | undefined;
    let level1CanaryProblemId: string | undefined;

    if (level === 2) {
      expiresAt = startedAt + ROUND_DURATION_L2_MS;
      const picked = selectLevel2SessionProblems(args.requestedLevel2Projects);
      problemIds = picked.map((problem) => problem.id);
      problemsToReturn = picked.map((p) => ({
        id: p.id,
        project: p.project,
        question: p.question,
      }));
    } else if (level === 3) {
      expiresAt = startedAt + ROUND_DURATION_L3_MS;
      let challenge: Level3ChallengeMeta;
      if (args.requestedLevel3ChallengeId) {
        const selected = getLevel3ChallengeMetaFromId(args.requestedLevel3ChallengeId);
        challenge = selected ?? generateLevel3ChallengeMeta();
      } else {
        challenge = generateLevel3ChallengeMeta();
      }
      problemIds = challenge.checks.map((c) => c.id);
      problemsToReturn = [
        {
          id: challenge.id,
          title: challenge.title,
          taskId: challenge.taskId,
          taskName: challenge.taskName,
          language: challenge.language,
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
      const canaryProblem = problemsToReturn.find(
        (problem) =>
          typeof problem.description === "string" &&
          problem.description.includes("// @ai-generated"),
      );
      level1CanaryProblemId = typeof canaryProblem?.id === "string" ? canaryProblem.id : undefined;
    }

    if (level !== 1) {
      publicPayloadJson = JSON.stringify(problemsToReturn);
    }

    const sessionId = await ctx.db.insert("sessions", {
      github,
      problemIds,
      startedAt,
      expiresAt,
      level,
      publicPayloadJson,
      level1CanaryProblemId,
    });

    return {
      sessionId,
      startedAt,
      expiresAt,
      problems: problemsToReturn,
      level,
      scoreSnapshot: await getScoreSnapshot(ctx, github),
    };
  },
});

export const create = action({
  args: {
    secret: v.string(),
    github: v.string(),
    requestedLevel: v.optional(v.number()),
    requestedLevel3ChallengeId: v.optional(v.string()),
    requestedLevel2Projects: v.optional(v.array(v.string())),
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
    scoreSnapshot: { elo: number; solved: number; rank: number } | null;
  }> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.runMutation(internal.sessions.createInternal, {
      github: args.github,
      requestedLevel: args.requestedLevel,
      requestedLevel3ChallengeId: args.requestedLevel3ChallengeId,
      requestedLevel2Projects: args.requestedLevel2Projects,
    });
  },
});

export const extendExpiryInternal = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    github: v.string(),
    extendMs: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("session not found");
    }
    if (session.github !== args.github) {
      throw new Error("github mismatch");
    }

    const extendMs = clampSessionPauseExtension(args.extendMs);
    const nextExpiresAt = session.expiresAt + extendMs;
    await ctx.db.patch(args.sessionId, { expiresAt: nextExpiresAt });

    return {
      sessionId: args.sessionId,
      expiresAt: nextExpiresAt,
    };
  },
});

export const extendExpiry = action({
  args: {
    secret: v.string(),
    sessionId: v.id("sessions"),
    github: v.string(),
    extendMs: v.number(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    sessionId: string;
    expiresAt: number;
  }> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.runMutation(internal.sessions.extendExpiryInternal, {
      sessionId: args.sessionId,
      github: args.github,
      extendMs: args.extendMs,
    });
  },
});

export const getSession = query({
  args: { secret: v.string(), sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.db.get(args.sessionId);
  },
});
