type TestCaseWithArgs = {
  args?: unknown[];
};

export function buildArgs(testCase: TestCaseWithArgs): unknown[] | null {
  if (Array.isArray(testCase.args)) return testCase.args;
  return null;
}
