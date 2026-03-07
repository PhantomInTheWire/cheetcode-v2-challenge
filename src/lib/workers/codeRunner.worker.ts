import { getQuickJS, type QuickJSWASMModule } from "quickjs-emscripten";

type TestCase = {
  input: Record<string, unknown>;
  expected: unknown;
  args?: unknown[];
};

type MessagePayload = {
  id: string;
  code: string;
  testCases: TestCase[];
};

type MessageResult = {
  id: string;
  passed: boolean;
};

// Cache WASM module at module scope
let _qjs: QuickJSWASMModule | null = null;
async function getQJS(): Promise<QuickJSWASMModule> {
  if (!_qjs) _qjs = await getQuickJS();
  return _qjs;
}

async function runTest(code: string, testCase: TestCase): Promise<boolean> {
  const qjs = await getQJS();
  const vm = qjs.newContext();

  try {
    // Inject console no-op for safety
    const setup = vm.evalCode(`globalThis.console={log(){},warn(){},error(){},info(){}};`);
    if ("error" in setup) {
      setup.error.dispose();
      return false;
    }
    setup.value.dispose();

    // Define function once
    const fnResult = vm.evalCode(`const __fn__ = (${code}); __fn__;`);
    if ("error" in fnResult) {
      fnResult.error.dispose();
      return false;
    }
    fnResult.value.dispose();

    // Run test case
    const argsList = Array.isArray(testCase.args) ? testCase.args : Object.values(testCase.input);
    const args = JSON.stringify(argsList);
    const expected = JSON.stringify(testCase.expected);

    const actualResult = vm.evalCode(`JSON.stringify(__fn__(...${args}));`);
    if ("error" in actualResult) {
      actualResult.error.dispose();
      return false;
    }

    const actualStr = vm.dump(actualResult.value) as string;
    actualResult.value.dispose();

    return actualStr === expected;
  } finally {
    vm.dispose();
  }
}

self.onmessage = async (event: MessageEvent<MessagePayload>) => {
  const { id, code, testCases } = event.data;
  try {
    const results = await Promise.all(testCases.map((testCase) => runTest(code, testCase)));
    const passed = results.every((result) => result);
    const response: MessageResult = { id, passed };
    self.postMessage(response);
  } catch {
    self.postMessage({ id, passed: false } satisfies MessageResult);
  }
};
