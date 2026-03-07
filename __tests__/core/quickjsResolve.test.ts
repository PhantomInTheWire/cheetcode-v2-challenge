import { describe, expect, it } from "vitest";
import { resolveSubmittedFunction } from "../../src/lib/quickjs";

type EvalResult = { value: { dispose: () => void } } | { error: { dispose: () => void } };

function handle() {
  return { dispose: () => undefined };
}

describe("quickjsResolve", () => {
  it("returns true when function expression resolves on fast path", () => {
    const vm = {
      dump: () => true,
    } as unknown as ReturnType<import("quickjs-emscripten").QuickJSWASMModule["newContext"]>;

    let calls = 0;
    const evalWithDeadline = (): EvalResult => {
      calls++;
      return { value: handle() };
    };

    const ok = resolveSubmittedFunction(vm, "(a,b)=>a+b", 250, evalWithDeadline as never);
    expect(ok).toBe(true);
    expect(calls).toBe(1);
  });

  it("falls back to named-symbol script path when expression parse fails", () => {
    const vm = {
      dump: () => true,
    } as unknown as ReturnType<import("quickjs-emscripten").QuickJSWASMModule["newContext"]>;

    let calls = 0;
    const evalWithDeadline = (): EvalResult => {
      calls++;
      if (calls === 1) return { error: handle() };
      return { value: handle() };
    };

    const ok = resolveSubmittedFunction(
      vm,
      "function sum(a,b){return a+b}",
      250,
      evalWithDeadline as never,
    );
    expect(ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("returns false when neither expression nor named symbol resolve", () => {
    const vm = {
      dump: () => false,
    } as unknown as ReturnType<import("quickjs-emscripten").QuickJSWASMModule["newContext"]>;

    const evalWithDeadline = (): EvalResult => ({ error: handle() });

    const ok = resolveSubmittedFunction(vm, "(() => 1)()", 250, evalWithDeadline as never);
    expect(ok).toBe(false);
  });
});
