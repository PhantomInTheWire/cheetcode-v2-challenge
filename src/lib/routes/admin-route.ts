import { NextResponse } from "next/server";
import { adminForbiddenResponse, isAdminGithub } from "../auth/admin-auth";
import { withAuthenticatedConvexRoute } from "./authenticated-route";

export async function withAdminConvexRoute(
  request: Request,
  handler: (ctx: {
    github: string;
    convex: import("convex/browser").ConvexHttpClient;
  }) => Promise<NextResponse>,
): Promise<NextResponse> {
  return withAuthenticatedConvexRoute(request, async ({ github, convex }) => {
    if (!isAdminGithub(github)) {
      return adminForbiddenResponse();
    }
    return handler({ github, convex });
  });
}
