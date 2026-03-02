import type { QuickJSWASMModule } from "quickjs-emscripten";

type EvalWithDeadlineFn = (
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
  timeoutMs: number,
) => { value?: unknown; error?: unknown };

export function resolveSubmittedFunction(
  vm: ReturnType<QuickJSWASMModule["newContext"]>,
  code: string,
  quickjsSetupTimeoutMs: number,
  evalWithDeadline: EvalWithDeadlineFn,
): boolean {
  const expressionAttempt = evalWithDeadline(
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

  const scriptAttempt = evalWithDeadline(
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
