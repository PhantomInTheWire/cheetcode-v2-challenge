import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../../convex/_generated/api";
import { adminForbiddenResponse, isAdminGithub } from "../../../../../lib/admin-auth";
import { ENV } from "../../../../../lib/env-vars";
import { requireAuthenticatedGithub } from "../../../../../lib/request-auth";

type ConvexQueryReference = Parameters<ConvexHttpClient["query"]>[0];
type ConvexActionReference = Parameters<ConvexHttpClient["action"]>[0];

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  if (!isAdminGithub(authResult.github)) return adminForbiddenResponse();

  const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);

  try {
    const getMigrationStatus = (
      api as typeof api & {
        sessionIdentity: { getFingerprintProfileSourceTrustMigrationStatus: ConvexQueryReference };
      }
    ).sessionIdentity.getFingerprintProfileSourceTrustMigrationStatus;
    const status = await convex.query(getMigrationStatus, {
      secret: ENV.CONVEX_MUTATION_SECRET,
    });
    return NextResponse.json(status);
  } catch (error) {
    console.error("/api/admin/fingerprint-profiles/migration GET error:", error);
    return NextResponse.json({ error: "Failed to load migration status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  if (!isAdminGithub(authResult.github)) return adminForbiddenResponse();

  const body = (await request.json().catch(() => ({}))) as { limit?: number };
  const normalizedLimit =
    Number.isFinite(body.limit) && Number(body.limit) > 0 ? Number(body.limit) : undefined;
  const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);

  try {
    const backfillSourceTrust = (
      api as typeof api & {
        sessionIdentity: { backfillFingerprintProfileSourceTrust: ConvexActionReference };
      }
    ).sessionIdentity.backfillFingerprintProfileSourceTrust;
    const result = await convex.action(backfillSourceTrust, {
      secret: ENV.CONVEX_MUTATION_SECRET,
      limit: normalizedLimit,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("/api/admin/fingerprint-profiles/migration POST error:", error);
    return NextResponse.json({ error: "Failed to run migration" }, { status: 500 });
  }
}
