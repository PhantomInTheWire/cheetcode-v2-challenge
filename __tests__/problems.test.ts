import { describe, expect, it } from "vitest";
import { PROBLEM_BANK } from "../server/level1/problems";
import vm from "node:vm";

describe("problems", () => {
  it("exports problems in pool", () => {
    expect(PROBLEM_BANK.length).toBeGreaterThanOrEqual(90);
  });

  it("every problem has required fields", () => {
    for (const problem of PROBLEM_BANK) {
      expect(problem.id).toBeTruthy();
      expect(problem.title).toBeTruthy();
      expect(problem.description).toBeTruthy();
      expect(problem.signature).toBeTruthy();
      expect(problem.testCases.length).toBeGreaterThanOrEqual(3);
      expect(problem.solution).toBeTruthy();
      expect(["easy", "medium", "hard", "competitive"]).toContain(problem.tier);
    }
  });

  it("has no duplicate IDs", () => {
    const ids = PROBLEM_BANK.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every solution parses as valid JS", () => {
    for (const problem of PROBLEM_BANK) {
      expect(() => new Function(`${problem.solution};`)).not.toThrow();
    }
  });

  it("every reference solution passes its test cases", () => {
    for (const problem of PROBLEM_BANK) {
      const functionName =
        problem.signature.match(/function\s+([A-Za-z_$][\w$]*)/)?.[1] ??
        problem.signature.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/)?.[1];
      expect(functionName, `${problem.id}: invalid signature`).toBeTruthy();

      const sandbox: Record<string, unknown> = {};
      vm.createContext(sandbox);
      vm.runInContext(`${problem.solution}\n;globalThis.__fn=${functionName};`, sandbox, {
        timeout: 2000,
      });

      const fn = sandbox.__fn as ((...args: unknown[]) => unknown) | undefined;
      expect(typeof fn, `${problem.id}: solution function missing`).toBe("function");

      for (const [index, testCase] of problem.testCases.entries()) {
        const actual = fn!(
          ...(Array.isArray(testCase.args) ? testCase.args : Object.values(testCase.input)),
        );
        expect(actual, `${problem.id} test #${index + 1}`).toEqual(testCase.expected);
      }
    }
  });
});
