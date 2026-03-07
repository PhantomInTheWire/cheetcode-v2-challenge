import {
  getQuickJS,
  shouldInterruptAfterDeadline,
  type QuickJSWASMModule,
} from "quickjs-emscripten";

export type { QuickJSWASMModule } from "quickjs-emscripten";

export const SANDBOX_FLAG = "🔥{you_found_the_fire}";
export const QUICKJS_TEST_TIMEOUT_MS = 2_000;
export const QUICKJS_SETUP_TIMEOUT_MS = 250;

type EvalWithDeadlineFn = (
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
  timeoutMs: number,
) => { value?: unknown; error?: unknown };

let qjs: QuickJSWASMModule | null = null;

export async function getQJS(): Promise<QuickJSWASMModule> {
  if (!qjs) qjs = await getQuickJS();
  return qjs;
}

export function evalWithDeadline(
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
  timeoutMs: number,
) {
  vm.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + timeoutMs));
  try {
    return vm.evalCode(code);
  } finally {
    vm.runtime.removeInterruptHandler();
  }
}

export function resolveSubmittedFunction(
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
  quickjsSetupTimeoutMs: number,
  evalWithDeadlineFn: EvalWithDeadlineFn,
): boolean {
  const expressionAttempt = evalWithDeadlineFn(
    vm,
    `globalThis.__fn__ = (${code}); typeof globalThis.__fn__ === "function";`,
    quickjsSetupTimeoutMs,
  );
  if (!("error" in expressionAttempt)) {
    const value = expressionAttempt.value as { dispose: () => void };
    const ok = vm.dump(value as never) === true;
    value.dispose();
    if (ok) return true;
  } else {
    (expressionAttempt.error as { dispose: () => void }).dispose();
  }

  const nameMatch = code.match(
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(|\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
  );
  const symbol = (nameMatch?.[1] || nameMatch?.[2] || "").trim();
  if (!symbol) return false;

  const scriptAttempt = evalWithDeadlineFn(
    vm,
    `${code}\n;globalThis.__fn__ = (typeof ${symbol} === "function") ? ${symbol} : undefined;\n` +
      `typeof globalThis.__fn__ === "function";`,
    quickjsSetupTimeoutMs,
  );
  if ("error" in scriptAttempt) {
    (scriptAttempt.error as { dispose: () => void }).dispose();
    return false;
  }
  const value = scriptAttempt.value as { dispose: () => void };
  const ok = vm.dump(value as never) === true;
  value.dispose();
  return ok;
}
