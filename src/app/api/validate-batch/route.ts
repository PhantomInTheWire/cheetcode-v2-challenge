import { NextResponse } from "next/server";
import { getQuickJS, type QuickJSWASMModule } from "quickjs-emscripten";
import { isServerDevMode } from "../../../lib/myEnv";

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

function buildArgs(testCase: TestCase): unknown[] | null {
  if (Array.isArray(testCase.args)) return testCase.args;
  return null;
}

const FLAG = "🔥{you_found_the_fire}";

let _qjs: QuickJSWASMModule | null = null;
async function getQJS(): Promise<QuickJSWASMModule> {
  if (!_qjs) _qjs = await getQuickJS();
  return _qjs;
}

function resolveSubmittedFunction(vm: ReturnType<QuickJSWASMModule["newContext"]>, code: string): boolean {
  const expressionAttempt = vm.evalCode(
    `globalThis.__fn__ = (${code}); typeof globalThis.__fn__ === "function";`,
  );
  if (!("error" in expressionAttempt)) {
    const ok = vm.dump(expressionAttempt.value) === true;
    expressionAttempt.value.dispose();
    if (ok) return true;
  } else {
    expressionAttempt.error.dispose();
  }

  const nameMatch = code.match(
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
  );
  const symbol = (nameMatch?.[1] || nameMatch?.[2] || "").trim();
  if (!symbol) return false;

  const scriptAttempt = vm.evalCode(
    `globalThis.__fn__ = (() => {` +
      `${code}\n` +
      `return (typeof ${symbol} === "function") ? ${symbol} : undefined;` +
    `})();\n` +
    `typeof globalThis.__fn__ === "function";`,
  );
  if ("error" in scriptAttempt) {
    scriptAttempt.error.dispose();
    return false;
  }
  const ok = vm.dump(scriptAttempt.value) === true;
  scriptAttempt.value.dispose();
  return ok;
}

function runValidationInContext(
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
  testCases: TestCase[],
): ValidationResult {
  const reset = vm.evalCode(`globalThis.__fn__ = undefined;`);
  if ("error" in reset) {
    reset.error.dispose();
    return { passed: false, error: "Reset failed", debug: { stage: "reset" } };
  }
  reset.value.dispose();

  if (!resolveSubmittedFunction(vm, code)) {
    return { passed: false, error: "Syntax error in submitted code", debug: { stage: "resolve" } };
  }

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const argsList = buildArgs(tc);
    if (!argsList) {
      return {
        passed: false,
        error: "Missing ordered testcase args",
        debug: { stage: "mismatch", testCaseIndex: i, expected: tc.expected, actual: "MISSING_ARGS" },
      };
    }
    const args = JSON.stringify(argsList);
    const actualResult = vm.evalCode(`JSON.stringify(__fn__(...${args}));`);
    if ("error" in actualResult) {
      actualResult.error.dispose();
      return { passed: false, error: "Runtime error", debug: { stage: "runtime", testCaseIndex: i } };
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
    const setup = vm.evalCode(
      `globalThis.console={log(){},warn(){},error(){},info(){}};` + `globalThis.__FIRECRAWL__="${FLAG}";`,
    );
    if ("error" in setup) {
      setup.error.dispose();
      return Object.fromEntries(items.map((item) => [item.problemId, { passed: false, error: "Setup failed" }]));
    }
    setup.value.dispose();

    const results: Record<string, { passed: boolean; error?: string }> = {};
    for (const item of items) {
      if (!item?.problemId || typeof item.code !== "string" || !Array.isArray(item.testCases)) continue;
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
    const body = (await request.json()) as Payload;
    if (!body?.items || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const qjs = await getQJS();
    const results = runBatchValidation(qjs, body.items);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
