import { NextResponse } from "next/server";
import { getQuickJS, type QuickJSWASMModule } from "quickjs-emscripten";
import { api } from "../../../../convex/_generated/api";
import { PROBLEM_BANK } from "../../../../server/problems";
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
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { evalWithDeadline } from "../../../lib/quickjsTimeout";
import { SHADOW_BAN_HEADER } from "../../../lib/abuse-guard";
import { resolveSubmittedFunction } from "../../../lib/quickjsResolve";
import { buildArgs } from "../../../lib/testcase-args";
import { requireOwnedSession } from "../../../lib/session-auth";
import { clampElapsed, getJsonBody, shadowBanResponse } from "../../../lib/api-route";

/**
 * POST /api/finish
 * End-to-end game submission handler:
 *   1. Validate each submission in a QuickJS WASM sandbox (secure, in-process)
 *   2. Detect exploit patterns and award capped bonuses
 *   3. Call Convex mutation to compute ELO and upsert leaderboard
 *   4. Return results + exploit messages to client/agent
 */

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

const FLAG = "🔥{you_found_the_fire}";
const QUICKJS_TEST_TIMEOUT_MS = 1_000;
const QUICKJS_SETUP_TIMEOUT_MS = 250;

// Cache the WASM module at module scope — loaded once, reused across requests
let _qjs: QuickJSWASMModule | null = null;
async function getQJS(): Promise<QuickJSWASMModule> {
  if (!_qjs) _qjs = await getQuickJS();
  return _qjs;
}

/**
 * Validate all test cases for one problem in a single VM context.
 * One VM per problem — fast, isolated, no cross-problem state leaks.
 */
function validateSubmission(
  qjs: QuickJSWASMModule,
  code: string,
  testCases: TestCase[],
  problemId?: string,
): boolean {
  const vm = qjs.newContext();
  try {
    // Inject console no-op + easter egg
    const setup = evalWithDeadline(
      vm,
      `globalThis.console={log(){},warn(){},error(){},info(){}};` +
        `globalThis.__FIRECRAWL__="${FLAG}";`,
      QUICKJS_SETUP_TIMEOUT_MS,
    );
    if ("error" in setup) {
      setup.error.dispose();
      return false;
    }
    setup.value.dispose();

    if (!resolveSubmittedFunction(vm, code, QUICKJS_SETUP_TIMEOUT_MS, evalWithDeadline))
      return false;

    // Run each test case against the already-defined function
    for (const tc of testCases) {
      const argsList = buildArgs(tc);
      if (!argsList) {
        if (problemId) {
          console.error(`[finish] missing testcase args for problemId=${problemId}`);
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
  try {
    const body = await getJsonBody<RequestBody>(request);
    if (!body) {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }
    const { sessionId, submissions, timeElapsed } = body;

    if (!sessionId || !Array.isArray(submissions) || typeof timeElapsed !== "number") {
      return NextResponse.json({ error: "invalid request" }, { status: 400 });
    }

    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const github = authResult.github;

    // Fetch session to get the assigned problem IDs
    const sessionResult = await requireOwnedSession(sessionId, github);
    if ("response" in sessionResult) return sessionResult.response;
    const { session, convex } = sessionResult;
    const sessionProblemIds = new Set(session.problemIds);

    // Load QuickJS WASM once, reuse for all problems
    const qjs = await getQJS();

    // Validate each submission — only accept problems assigned to this session
    const solvedProblemIds: string[] = [];
    let extraSubmissions = 0;
    for (const sub of submissions) {
      const problem = PROBLEM_BANK.find((p) => p.id === sub.problemId);
      if (!problem || !sub.code.trim()) continue;

      // Track submissions for problems outside this session
      if (!sessionProblemIds.has(sub.problemId)) {
        extraSubmissions++;
        continue;
      }

      // Reject oversized code submissions
      const codeResult = validateCode(sub.code);
      if (codeResult.ok === false) continue;

      const passed = validateSubmission(qjs, codeResult.value, problem.testCases, problem.id);
      if (passed) solvedProblemIds.push(sub.problemId);
    }

    // Detect exploit patterns — reward discovery with capped bonuses
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

    // Detect landmines — penalize unsafe agent behavior
    const hasInjectionEchoHeader = request.headers.has(INJECTION_ECHO_HEADER);
    const landmines = detectLandmines({
      submittedCodes: submissions.map((s) => s.code),
      hasInjectionEchoHeader,
    });
    const landminePenalty = totalLandminePenalty(landmines);

    // CTF behavior: trust client-reported elapsed time.
    const clampedTimeElapsedMs = clientElapsedMs;

    // Net modifier = exploit bonuses + landmine penalties (penalties are negative)
    const scoreModifier = exploitBonus + landminePenalty;

    if (request.headers.get(SHADOW_BAN_HEADER) === "1") {
      return shadowBanResponse(ROUND_DURATION_MS, clampedTimeElapsedMs, {
        exploits: exploits.map((e) => ({ id: e.id, bonus: e.bonus, message: e.message })),
        landmines: landmines.map((l) => ({ id: l.id, penalty: l.penalty, message: l.message })),
      });
    }

    // Record results via authenticated Convex action
    const result = await convex.action(api.submissions.recordResults, {
      secret: process.env.CONVEX_MUTATION_SECRET!,
      sessionId: sessionId as Id<"sessions">,
      github,
      solvedProblemIds,
      timeElapsedMs: clampedTimeElapsedMs,
      exploitBonus: scoreModifier,
    });

    // Return full breakdown — exploits, landmines, and educational messages
    return NextResponse.json({
      ...result,
      exploits: exploits.map((e) => ({ id: e.id, bonus: e.bonus, message: e.message })),
      landmines: landmines.map((l) => ({ id: l.id, penalty: l.penalty, message: l.message })),
    });
  } catch (err) {
    console.error("/api/finish error:", err);
    return NextResponse.json(
      {
        error: "submission failed",
        elo: 0,
        solved: 0,
        rank: 0,
        timeRemaining: 0,
        exploits: [],
        landmines: [],
      },
      { status: 500 },
    );
  }
}
