import { v } from "convex/values";
import { internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { validateGithub, validateEmail, validateXHandle } from "../src/lib/validation";

export const submitInternal = internalMutation({
  args: {
    github: v.string(),
    email: v.string(),
    xHandle: v.optional(v.string()),
    flag: v.optional(v.string()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const ghResult = validateGithub(args.github);
    if (ghResult.ok === false) throw new Error(ghResult.error);
    const emailResult = validateEmail(args.email);
    if (emailResult.ok === false) throw new Error(emailResult.error);
    if (args.xHandle) {
      const xResult = validateXHandle(args.xHandle);
      if (xResult.ok === false) throw new Error(xResult.error);
    }

    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      throw new Error("session not found");
    }

    // Verify the github matches the session owner
    if (ghResult.value !== session.github) {
      throw new Error("github mismatch");
    }

    const leaderboardRow = await ctx.db
      .query("leaderboard")
      .withIndex("by_github", (query) => query.eq("github", ghResult.value))
      .first();

    if (!leaderboardRow || leaderboardRow.solved < 3) {
      throw new Error("3+ solved required");
    }

    const existing = await ctx.db
      .query("leads")
      .withIndex("by_github", (query) => query.eq("github", ghResult.value))
      .first();

    const xNormalized = args.xHandle ? validateXHandle(args.xHandle) : null;
    const payload = {
      github: ghResult.value,
      email: emailResult.value,
      xHandle: xNormalized && xNormalized.ok && xNormalized.value ? xNormalized.value : undefined,
      flag: args.flag,
      elo: leaderboardRow.elo,
      solved: leaderboardRow.solved,
      sessionId: args.sessionId,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { ok: true, upserted: "updated" };
    }

    await ctx.db.insert("leads", payload);
    return { ok: true, upserted: "created" };
  },
});

/** Authenticated gateway — only the Next.js server can call this */
export const submit = action({
  args: {
    secret: v.string(),
    github: v.string(),
    email: v.string(),
    xHandle: v.optional(v.string()),
    flag: v.optional(v.string()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<{ ok: boolean; upserted: string }> => {
    if (args.secret !== process.env.CONVEX_MUTATION_SECRET) {
      throw new Error("unauthorized");
    }
    return await ctx.runMutation(internal.leads.submitInternal, {
      github: args.github,
      email: args.email,
      xHandle: args.xHandle,
      flag: args.flag,
      sessionId: args.sessionId,
    });
  },
});
