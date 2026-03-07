import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { PROBLEM_BANK } from "../../../../../server/level1/problems";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { validateCode } from "@/lib/validation";
import {
  detectExploits,
  totalExploitBonus,
  detectLandmines,
  totalLandminePenalty,
  INJECTION_ECHO_HEADER,
} from "@/lib/game/scoring";
import { ROUND_DURATION_MS } from "@/lib/config/constants";
import { evalWithDeadline } from "@/lib/quickjs";
import { SHADOW_BAN_HEADER } from "@/lib/abuse/guard";
import { resolveSubmittedFunction } from "@/lib/quickjs";
import { buildArgs } from "@/lib/game/testcaseArgs";
import { clampElapsed, shadowBanResponse } from "@/lib/routes/api-route";
import {
  SANDBOX_FLAG,
  QUICKJS_TEST_TIMEOUT_MS,
  QUICKJS_SETUP_TIMEOUT_MS,
  getQJS,
  type QuickJSWASMModule,
} from "@/lib/quickjs";
import { ENV } from "@/lib/config/env";
import { withAuthenticatedSession } from "@/lib/routes/route-handler";
import { scheduleAfter } from "@/lib/routes/safe-after";
import { recordBuiltTelemetry } from "@/lib/telemetry/attempt-telemetry";

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
  runScoreSnapshot?: { elo?: number; solved?: number };
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
          console.error(`[level-1-finish] missing testcase args for problemId=${problemId}`);
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
    {
      expectedLevel: 1,
      validateBody: (body): body is RequestBody => {
        if (!body || typeof body !== "object") return false;
        const candidate = body as Partial<RequestBody>;
        return (
          typeof candidate.sessionId === "string" &&
          Array.isArray(candidate.submissions) &&
          typeof candidate.timeElapsed === "number" &&
          (candidate.flag === undefined || typeof candidate.flag === "string")
        );
      },
    },
    async ({ github, session, convex, body }) => {
      const { sessionId, submissions, timeElapsed } = body;

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
        scheduleAfter(async () => {
          await recordBuiltTelemetry({
            convex,
            sessionId: sessionId as Id<"sessions">,
            github,
            level: 1,
            eventType: "finish_l1",
            elapsedMs: clampedTimeElapsedMs,
            route: "/api/level-1/finish",
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

      scheduleAfter(async () => {
        await recordBuiltTelemetry({
          convex,
          sessionId: sessionId as Id<"sessions">,
          github,
          level: 1,
          eventType: "finish_l1",
          elapsedMs: clampedTimeElapsedMs,
          route: "/api/level-1/finish",
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
      });

      return NextResponse.json({
        elo: result.elo,
        solved: result.solved,
        rank: result.rank,
        timeRemaining: result.timeRemaining,
        scoreSnapshot: {
          elo: result.totalElo ?? result.elo,
          solved: result.totalSolved ?? result.solved,
          rank: result.rank,
        },
        completedLevel: solvedProblemIds.length === session.problemIds.length,
        exploits: exploits.map((e) => ({ id: e.id, bonus: e.bonus, message: e.message })),
        landmines: landmines.map((l) => ({ id: l.id, penalty: l.penalty, message: l.message })),
      });
    },
  );
}
