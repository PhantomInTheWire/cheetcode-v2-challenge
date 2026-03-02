import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { auth } from "../../../../auth";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * POST /api/leads
 * Submit lead/contact info after scoring 3+.
 * Auth: OAuth session cookie (browser users only).
 */
export async function POST(request: Request) {
  const session = await auth();
  const github = (session?.user as { githubUsername?: string })?.githubUsername ?? null;

  if (!github) {
    return NextResponse.json({ error: "GitHub authentication required" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const result = await convex.action(api.leads.submit, {
      secret: process.env.CONVEX_MUTATION_SECRET!,
      github,
      email: body.email,
      xHandle: body.xHandle,
      flag: body.flag,
      sessionId: body.sessionId as Id<"sessions">,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lead submission failed";
    console.error("/api/leads error:", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
