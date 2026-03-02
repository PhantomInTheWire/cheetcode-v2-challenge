import { NextResponse } from "next/server";
import { validateLevel3Submission } from "../../../../server/level3/validation";

/**
 * POST /api/validate-l3
 * Body: { challengeId: string, code: string }
 * Runs native compile+harness inside Vercel Sandbox (Firecracker VM).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { challengeId, code } = body as { challengeId?: string; code?: string };

    if (!challengeId || typeof challengeId !== "string") {
      return NextResponse.json({ error: "Invalid challengeId" }, { status: 400 });
    }
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const result = await validateLevel3Submission(challengeId, code);
    return NextResponse.json(result);
  } catch (error) {
    console.error("/api/validate-l3 error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
