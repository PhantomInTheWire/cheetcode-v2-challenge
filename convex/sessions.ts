import { v } from "convex/values";
import { internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  selectSessionProblems,
  stripSolution,
} from "../server/problems";
import { validateGithub } from "../src/lib/validation";

const SESSION_COOLDOWN_MS = 5_000;

export const createInternal = internalMutation({
  args: { github: v.string() },
  handler: async (ctx, args) => {
    const ghResult = validateGithub(args.github);
    if (ghResult.ok === false) throw new Error(ghResult.error);
    const github = ghResult.value;

    // Rate limit: reject if user has a session created in the last few seconds
    const recent = await ctx.db
      .query("sessions")
      .withIndex("by_github", (q) => q.eq("github", github))
      .order("desc")
      .first();
    if (recent && Date.now() - recent.startedAt < SESSION_COOLDOWN_MS) {
      throw new Error("rate limited — wait a few seconds");
    }

    const picked = selectSessionProblems();
    const startedAt = Date.now();
    const expiresAt = startedAt + 60_000;
    const sessionId = await ctx.db.insert("sessions", {
      github,
      problemIds: picked.map((problem) => problem.id),
      startedAt,
      expiresAt,
    });

    return {
      sessionId,
      startedAt,
      expiresAt,
      problems: picked.map(stripSolution),
    };
  },
});

/** Authenticated gateway — only the Next.js server can call this */
export const create = action({
  args: { secret: v.string(), github: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    sessionId: string;
    startedAt: number;
    expiresAt: number;
    problems: Record<string, unknown>[];
  }> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.runMutation(internal.sessions.createInternal, {
      github: args.github,
    });
  },
});
