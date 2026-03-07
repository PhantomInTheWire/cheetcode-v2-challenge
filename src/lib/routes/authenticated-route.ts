import type { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "../auth/request-auth";
import { getConvexHttpClient } from "../convex/http-client";

type AuthenticatedRouteContext = {
  github: string;
};

type AuthenticatedConvexRouteContext = AuthenticatedRouteContext & {
  convex: ConvexHttpClient;
};

export async function withAuthenticatedRoute(
  request: Request,
  handler: (ctx: AuthenticatedRouteContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) {
    return authResult.response;
  }
  return handler({ github: authResult.github });
}

export async function withAuthenticatedConvexRoute(
  request: Request,
  handler: (ctx: AuthenticatedConvexRouteContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withAuthenticatedRoute(request, async ({ github }) =>
    handler({
      github,
      convex: getConvexHttpClient(),
    }),
  );
}
