import { NextResponse } from "next/server";
import { requireAuthenticatedGithub } from "../auth/request-auth";
import { isServerDevMode } from "../config/env";
import { getJsonBody } from "./api-route";

type DevRouteOptions<TBody> = {
  validateBody: (body: unknown) => body is TBody;
  invalidBodyMessage: string;
  errorMessage?: string;
};

export async function withDevRoute<TBody>(
  request: Request,
  options: DevRouteOptions<TBody>,
  handler: (ctx: { body: TBody; github: string }) => Promise<NextResponse>,
) {
  if (!isServerDevMode()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;

  try {
    const body = await getJsonBody<unknown>(request);
    if (!options.validateBody(body)) {
      return NextResponse.json({ error: options.invalidBodyMessage }, { status: 400 });
    }

    return await handler({ body, github: authResult.github });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : (options.errorMessage ?? "request failed"),
      },
      { status: 400 },
    );
  }
}
