import { getQuickJS, type QuickJSWASMModule } from "quickjs-emscripten";

export type { QuickJSWASMModule } from "quickjs-emscripten";

/** Hidden flag injected into the QuickJS sandbox — discoverable by probing globalThis */
export const SANDBOX_FLAG = "🔥{you_found_the_fire}";

/** Per-test-case execution timeout inside QuickJS VM */
export const QUICKJS_TEST_TIMEOUT_MS = 1_000;

/** Timeout for VM setup operations (console injection, function resolution) */
export const QUICKJS_SETUP_TIMEOUT_MS = 250;

/** Cached WASM module — loaded once at module scope, reused across requests */
let _qjs: QuickJSWASMModule | null = null;
export async function getQJS(): Promise<QuickJSWASMModule> {
  if (!_qjs) _qjs = await getQuickJS();
  return _qjs;
}
