import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import type { Id } from "../../../../convex/_generated/dataModel";

/**
 * POST /api/leads
 * Submit lead/contact info after scoring 3+.
 * Auth: GitHub PAT or OAuth session.
 */
export async function POST(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  const { github } = authResult;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexSecret = process.env.CONVEX_MUTATION_SECRET;

  if (!convexUrl || !convexSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const convex = new ConvexHttpClient(convexUrl);
    const result = await convex.action(api.leads.submit, {
      secret: convexSecret,
      github,
      email: body.email,
      xHandle: body.xHandle,
      flag: body.flag,
      sessionId: body.sessionId as Id<"sessions">,
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("/api/leads error:", err);
    return NextResponse.json({ error: "Lead submission failed" }, { status: 400 });
  }
}
