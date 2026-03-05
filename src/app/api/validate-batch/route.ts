import { NextResponse } from "next/server";
import { isServerDevMode } from "../../../lib/myEnv";
import { requireAuthenticatedGithub } from "../../../lib/request-auth";
import { evalWithDeadline } from "../../../lib/quickjsTimeout";
import { resolveSubmittedFunction } from "../../../lib/quickjsResolve";
import { buildArgs } from "../../../lib/testcaseArgs";
import {
  SANDBOX_FLAG,
  QUICKJS_TEST_TIMEOUT_MS,
  QUICKJS_SETUP_TIMEOUT_MS,
  getQJS,
  type QuickJSWASMModule,
} from "../../../lib/quickjs-shared";
import { requireOwnedSession } from "../../../lib/session-auth";

type TestCase = {
  input: Record<string, unknown>;
  expected: unknown;
  args?: unknown[];
};

type BatchItem = {
  problemId: string;
  code: string;
  testCases: TestCase[];
};

type Payload = {
  sessionId: string;
  items: BatchItem[];
};

type ValidationDebug = {
  stage: "reset" | "resolve" | "runtime" | "mismatch";
  testCaseIndex?: number;
  expected?: unknown;
  actual?: unknown;
};

type ValidationResult = {
  passed: boolean;
  error?: string;
  debug?: ValidationDebug;
};

function runValidationInContext(
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
  testCases: TestCase[],
): ValidationResult {
  const reset = evalWithDeadline(vm, `globalThis.__fn__ = undefined;`, QUICKJS_SETUP_TIMEOUT_MS);
  if ("error" in reset) {
    reset.error.dispose();
    return { passed: false, error: "Reset failed", debug: { stage: "reset" } };
  }
  reset.value.dispose();

  if (!resolveSubmittedFunction(vm, code, QUICKJS_SETUP_TIMEOUT_MS, evalWithDeadline)) {
    return { passed: false, error: "Syntax error in submitted code", debug: { stage: "resolve" } };
  }

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const argsList = buildArgs(tc);
    if (!argsList) {
      return {
        passed: false,
        error: "Missing ordered testcase args",
        debug: {
          stage: "mismatch",
          testCaseIndex: i,
          expected: tc.expected,
          actual: "MISSING_ARGS",
        },
      };
    }
    const args = JSON.stringify(argsList);
    const actualResult = evalWithDeadline(
      vm,
      `JSON.stringify(__fn__(...${args}));`,
      QUICKJS_TEST_TIMEOUT_MS,
    );
    if ("error" in actualResult) {
      const errDump = vm.dump(actualResult.error) as { message?: string } | string;
      const errMessage =
        typeof errDump === "string" ? errDump : (errDump?.message ?? "Runtime error");
      actualResult.error.dispose();
      const isTimeout = errMessage.toLowerCase().includes("interrupted");
      return {
        passed: false,
        error: isTimeout
          ? `Time limit exceeded (${QUICKJS_TEST_TIMEOUT_MS}ms per test)`
          : "Runtime error",
        debug: {
          stage: "runtime",
          testCaseIndex: i,
          actual: isTimeout ? "TIMEOUT" : undefined,
        },
      };
    }
    const actualStr = vm.dump(actualResult.value);
    actualResult.value.dispose();
    const expectedStr = JSON.stringify(tc.expected);
    if (actualStr !== expectedStr) {
      let actual: unknown;
      try {
        actual = typeof actualStr === "string" ? JSON.parse(actualStr) : actualStr;
      } catch {
        actual = actualStr;
      }
      return {
        passed: false,
        debug: {
          stage: "mismatch",
          testCaseIndex: i,
          expected: tc.expected,
          actual,
        },
      };
    }
  }
  return { passed: true };
}

function runBatchValidation(
  qjs: QuickJSWASMModule,
  items: BatchItem[],
): Record<string, { passed: boolean; error?: string }> {
  const vm = qjs.newContext();
  const debugMode = isServerDevMode();
  const startedAt = Date.now();
  try {
    const setup = evalWithDeadline(
      vm,
      `globalThis.console={log(){},warn(){},error(){},info(){}};` +
        `globalThis.__FIRECRAWL__="${SANDBOX_FLAG}";`,
      QUICKJS_SETUP_TIMEOUT_MS,
    );
    if ("error" in setup) {
      setup.error.dispose();
      return Object.fromEntries(
        items.map((item) => [item.problemId, { passed: false, error: "Setup failed" }]),
      );
    }
    setup.value.dispose();

    const results: Record<string, { passed: boolean; error?: string }> = {};
    for (const item of items) {
      if (!item?.problemId || typeof item.code !== "string" || !Array.isArray(item.testCases))
        continue;
      const itemStart = Date.now();
      const result = runValidationInContext(vm, item.code, item.testCases);
      results[item.problemId] = { passed: result.passed, error: result.error };
      if (debugMode && !result.passed) {
        const codeBytes = new TextEncoder().encode(item.code).length;
        console.warn(
          `[validate-batch] fail problemId=${item.problemId} stage=${result.debug?.stage ?? "unknown"} ` +
            `tc=${result.debug?.testCaseIndex ?? -1} tests=${item.testCases.length} codeBytes=${codeBytes} ` +
            `durationMs=${Date.now() - itemStart} expected=${JSON.stringify(result.debug?.expected)} ` +
            `actual=${JSON.stringify(result.debug?.actual)}`,
        );
      }
    }
    if (debugMode) {
      const passedCount = Object.values(results).filter((r) => r.passed).length;
      console.log(
        `[validate-batch] items=${items.length} passed=${passedCount} failed=${items.length - passedCount} ` +
          `totalMs=${Date.now() - startedAt}`,
      );
    }
    return results;
  } finally {
    vm.dispose();
  }
}

export async function POST(request: Request) {
  try {
    const authResult = await requireAuthenticatedGithub(request);
    if ("response" in authResult) return authResult.response;
    const { github } = authResult;

    const body = (await request.json()) as Payload;
    if (!body?.sessionId || !body?.items || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const sessionResult = await requireOwnedSession(body.sessionId, github, 1);
    if ("response" in sessionResult) return sessionResult.response;

    const sessionProblemIds = new Set(sessionResult.session.problemIds);
    const hasInvalidProblem = body.items.some((item) => !sessionProblemIds.has(item.problemId));
    if (hasInvalidProblem) {
      return NextResponse.json({ error: "Invalid problem set for session" }, { status: 400 });
    }

    const qjs = await getQJS();
    const results = runBatchValidation(qjs, body.items);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
