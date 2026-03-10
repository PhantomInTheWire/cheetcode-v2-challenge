import { NextResponse } from "next/server";
import { isServerDevMode } from "../../../../lib/myEnv";
import { handleValidateBatch } from "../../../../lib/validate-batch-route";

export async function POST(request: Request) {
  if (!isServerDevMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return handleValidateBatch(request);
}
