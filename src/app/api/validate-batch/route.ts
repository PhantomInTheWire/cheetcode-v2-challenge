import { NextResponse } from "next/server";

/**
 * Batch validation is an internal/dev-only auto-solve primitive. Production
 * validation routes stay session-backed under the dedicated public endpoints.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Not found. Use /api/dev/validate-batch in local dev workflows." },
    { status: 404 },
  );
}
