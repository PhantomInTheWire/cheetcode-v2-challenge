import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ENV } from "../../../lib/config/env";
import { withOwnedSessionRoute } from "../../../lib/routes/route-handler";

type LeadRequestBody = {
  email: string;
  flag?: string;
  sessionId: string;
  xHandle?: string;
};

export async function POST(request: Request) {
  return withOwnedSessionRoute<LeadRequestBody>(
    request,
    {
      validateBody: (body): body is LeadRequestBody => {
        if (!body || typeof body !== "object") return false;
        const candidate = body as Partial<LeadRequestBody>;
        return (
          typeof candidate.sessionId === "string" &&
          typeof candidate.email === "string" &&
          (candidate.xHandle === undefined || typeof candidate.xHandle === "string") &&
          (candidate.flag === undefined || typeof candidate.flag === "string")
        );
      },
      errorLabel: "/api/leads error",
      invalidBodyResponse: NextResponse.json({ error: "invalid request" }, { status: 400 }),
      errorResponse: NextResponse.json({ error: "Lead submission failed" }, { status: 500 }),
    },
    async ({ body, convex, github }) => {
      const result = await convex.action(api.leads.submit, {
        secret: ENV.CONVEX_MUTATION_SECRET,
        github,
        email: body.email,
        xHandle: body.xHandle,
        flag: body.flag,
        sessionId: body.sessionId as Id<"sessions">,
      });
      return NextResponse.json(result);
    },
  );
}
