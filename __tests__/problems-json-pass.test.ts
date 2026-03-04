import { describe, expect, it } from "vitest";
import { getQuickJS, type QuickJSWASMModule } from "quickjs-emscripten";
import fs from "node:fs";
import { normalizeTestCasesWithArgs } from "../src/lib/testcaseArgs";

type TestCase = {
  input: Record<string, unknown>;
  expected: unknown;
};

type Problem = {
  id: string;
  signature: string;
  solution: string;
  testCases: TestCase[];
};

function resolveSubmittedFunction(
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
): boolean {
  const expressionAttempt = vm.evalCode(`const __fn__ = (${code}); typeof __fn__ === "function";`);
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
    `${code}\n;globalThis.__fn__ = (typeof ${symbol} === "function") ? ${symbol} : undefined;\n` +
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

describe("level1-questions.json reference solutions", () => {
  it("all problems pass their test cases under QuickJS", async () => {
    const raw = fs.readFileSync("data/level1-questions.json", "utf8");
    const parsed = JSON.parse(raw) as { problems: Problem[] };
    const qjs = await getQuickJS();

    const failures: Array<{ id: string; reason: string }> = [];

    for (const problem of parsed.problems) {
      const vm = qjs.newContext();
      try {
        const setup = vm.evalCode(`globalThis.console={log(){},warn(){},error(){},info(){}};`);
        if ("error" in setup) {
          setup.error.dispose();
          failures.push({ id: problem.id, reason: "setup failed" });
          continue;
        }
        setup.value.dispose();

        if (!resolveSubmittedFunction(vm, problem.solution)) {
          failures.push({ id: problem.id, reason: "function resolution failed" });
          continue;
        }

        let passedAll = true;
        const normalizedCases = normalizeTestCasesWithArgs(problem.signature, problem.testCases);
        for (const testCase of normalizedCases) {
          const args = JSON.stringify(
            Array.isArray(testCase.args) ? testCase.args : Object.values(testCase.input),
          );
          const expected = JSON.stringify(testCase.expected);
          const result = vm.evalCode(
            `JSON.stringify(__fn__(...${args})) === ${JSON.stringify(expected)};`,
          );
          if ("error" in result) {
            result.error.dispose();
            passedAll = false;
            break;
          }
          const passed = vm.dump(result.value) === true;
          result.value.dispose();
          if (!passed) {
            passedAll = false;
            break;
          }
        }

        if (!passedAll) {
          failures.push({ id: problem.id, reason: "test case mismatch" });
        }
      } finally {
        vm.dispose();
      }
    }

    expect(failures).toEqual([]);
  });
});
