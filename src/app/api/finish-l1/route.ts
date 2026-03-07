import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { PROBLEM_BANK } from "../../../../server/level1/problems";
import type { Id } from "../../../../convex/_generated/dataModel";
import { validateCode } from "../../../lib/validation";
import {
  detectExploits,
  totalExploitBonus,
  detectLandmines,
  totalLandminePenalty,
  INJECTION_ECHO_HEADER,
} from "../../../lib/scoring";
import { ROUND_DURATION_MS } from "../../../lib/constants";
import { evalWithDeadline } from "../../../lib/quickjsTimeout";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse";
import { resolveSubmittedFunction } from "../../../lib/quickjsResolve";
import { buildArgs } from "../../../lib/testcaseArgs";
import { clampElapsed, shadowBanResponse } from "../../../lib/api-route";
import {
  SANDBOX_FLAG,
  QUICKJS_TEST_TIMEOUT_MS,
  QUICKJS_SETUP_TIMEOUT_MS,
  getQJS,
  type QuickJSWASMModule,
} from "../../../lib/quickjs-shared";
import { ENV } from "../../../lib/env-vars";
import { withAuthenticatedSession } from "../../../lib/route-handler";
import { recordBuiltTelemetry } from "../../../lib/attempt-telemetry";

type TestCase = {
  input: Record<string, unknown>;
  expected: unknown;
  args?: unknown[];
};

type Submission = {
  problemId: string;
  code: string;
};

type RequestBody = {
  sessionId: string;
  submissions: Submission[];
  timeElapsed: number;
  flag?: string; // agents can submit the hidden flag for bonus ELO
};

const PROBLEM_BANK_BY_ID = new Map(PROBLEM_BANK.map((problem) => [problem.id, problem]));

function validateSubmission(
  qjs: QuickJSWASMModule,
  code: string,
  testCases: TestCase[],
  problemId?: string,
): boolean {
  const vm = qjs.newContext();
  try {
    const setup = evalWithDeadline(
      vm,
      `globalThis.console={log(){},warn(){},error(){},info(){}};` +
        `globalThis.__FIRECRAWL__="${SANDBOX_FLAG}";`,
      QUICKJS_SETUP_TIMEOUT_MS,
    );
    if ("error" in setup) {
      setup.error.dispose();
      return false;
    }
    setup.value.dispose();

    if (!resolveSubmittedFunction(vm, code, QUICKJS_SETUP_TIMEOUT_MS, evalWithDeadline))
      return false;

    for (const tc of testCases) {
      const argsList = buildArgs(tc);
      if (!argsList) {
        if (problemId) {
          console.error(`[finish-l1] missing testcase args for problemId=${problemId}`);
        }
        return false;
      }
      const args = JSON.stringify(argsList);
      const expected = JSON.stringify(tc.expected);
      const testScript = `JSON.stringify(__fn__(...${args})) === ${JSON.stringify(expected)};`;

      const result = evalWithDeadline(vm, testScript, QUICKJS_TEST_TIMEOUT_MS);
      if ("error" in result) {
        result.error.dispose();
        return false;
      }
      const passed = vm.dump(result.value) === true;
      result.value.dispose();
      if (!passed) return false;
    }

    return true;
  } finally {
    vm.dispose();
  }
}

export async function POST(request: Request) {
  return withAuthenticatedSession<RequestBody>(
    request,
    1,
    async ({ github, session, convex, body }) => {
      const { sessionId, submissions, timeElapsed } = body;

      if (!Array.isArray(submissions) || typeof timeElapsed !== "number") {
        return NextResponse.json({ error: "invalid request" }, { status: 400 });
      }

      const sessionProblemIds = new Set(session.problemIds);

      // Load QuickJS WASM once, reuse for all problems
      const qjs = await getQJS();

      const solvedProblemIds: string[] = [];
      let extraSubmissions = 0;
      for (const sub of submissions) {
        const problem = PROBLEM_BANK_BY_ID.get(sub.problemId);
        if (!problem || !sub.code.trim()) continue;

        if (!sessionProblemIds.has(sub.problemId)) {
          extraSubmissions++;
          continue;
        }

        const codeResult = validateCode(sub.code);
        if (codeResult.ok === false) continue;

        const passed = validateSubmission(qjs, codeResult.value, problem.testCases, problem.id);
        if (passed) solvedProblemIds.push(sub.problemId);
      }

      const hasHackHeader = request.headers.get("x-firecrawl-hack") === "true";
      const exploits = detectExploits({
        timeElapsedMs: timeElapsed,
        solvedCount: solvedProblemIds.length,
        flag: body.flag,
        hasHackHeader,
        extraSubmissions,
      });
      const clientElapsedMs = clampElapsed(timeElapsed, ROUND_DURATION_MS);
      const exploitBonus = totalExploitBonus(exploits);

      const hasInjectionEchoHeader = request.headers.has(INJECTION_ECHO_HEADER);
      const landmines = detectLandmines({
        submittedCodes: submissions.map((s) => s.code),
        hasInjectionEchoHeader,
      });
      const landminePenalty = totalLandminePenalty(landmines);

      const clampedTimeElapsedMs = clientElapsedMs;
      const scoreModifier = exploitBonus + landminePenalty;

      if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
        const response = shadowBanResponse(ROUND_DURATION_MS, clampedTimeElapsedMs, {
          exploits: exploits.map((e) => ({ id: e.id, bonus: e.bonus, message: e.message })),
          landmines: landmines.map((l) => ({ id: l.id, penalty: l.penalty, message: l.message })),
        });
        await recordBuiltTelemetry({
          convex,
          sessionId: sessionId as Id<"sessions">,
          github,
          level: 1,
          eventType: "finish_l1",
          elapsedMs: clampedTimeElapsedMs,
          route: "/api/finish-l1",
          status: "shadow_banned",
          errorType: "shadow_ban",
          solvedCount: solvedProblemIds.length,
          summary: {
            exploitIds: exploits.map((e) => e.id),
            landmineIds: landmines.map((l) => l.id),
          },
          artifact: {
            sessionId,
            submissions,
            flag: body.flag,
            solvedProblemIds,
            exploits,
            landmines,
          },
        });
        return response;
      }

      const result = await convex.action(api.submissions.recordResults, {
        secret: ENV.CONVEX_MUTATION_SECRET,
        sessionId: sessionId as Id<"sessions">,
        github,
        solvedProblemIds,
        timeElapsedMs: clampedTimeElapsedMs,
        exploitBonus: scoreModifier,
      });

      const status =
        solvedProblemIds.length === 0
          ? "failed"
          : solvedProblemIds.length === session.problemIds.length
            ? "passed"
            : "partial";

      await recordBuiltTelemetry({
        convex,
        sessionId: sessionId as Id<"sessions">,
        github,
        level: 1,
        eventType: "finish_l1",
        elapsedMs: clampedTimeElapsedMs,
        route: "/api/finish-l1",
        status,
        solvedCount: solvedProblemIds.length,
        passCount: solvedProblemIds.length,
        failCount: session.problemIds.length - solvedProblemIds.length,
        summary: {
          exploitIds: exploits.map((e) => e.id),
          landmineIds: landmines.map((l) => l.id),
        },
        artifact: {
          sessionId,
          submissions,
          flag: body.flag,
          solvedProblemIds,
          exploits,
          landmines,
          result,
        },
      });

      return NextResponse.json({
        ...result,
        completedLevel: solvedProblemIds.length === session.problemIds.length,
        exploits: exploits.map((e) => ({ id: e.id, bonus: e.bonus, message: e.message })),
        landmines: landmines.map((l) => ({ id: l.id, penalty: l.penalty, message: l.message })),
      });
    },
  );
}
