import { shouldInterruptAfterDeadline, type QuickJSWASMModule } from "quickjs-emscripten";

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
