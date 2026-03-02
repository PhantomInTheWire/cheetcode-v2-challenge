export type ArgsTestCase = {
  input: Record<string, unknown>;
  expected: unknown;
  args?: unknown[];
};

export function buildArgs(testCase: { args?: unknown[] }): unknown[] | null {
  if (Array.isArray(testCase.args)) return testCase.args;
  return null;
}

export function extractSignatureParamNames(signature: string): string[] {
  const match = signature.match(/\(([^)]*)\)/);
  const raw = (match?.[1] ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part
        .replace(/^\.{3}/, "")
        .replace(/\s*=.*$/, "")
        .replace(/\?.*$/, "")
        .replace(/\s*:\s*.+$/, "")
        .trim(),
    )
    .filter(Boolean);
}

export function normalizeTestCasesWithArgs<T extends ArgsTestCase>(
  signature: string,
  testCases: T[],
): T[] {
  const parameterNames = extractSignatureParamNames(signature);
  return testCases.map((testCase) => {
    if (Array.isArray(testCase.args)) return testCase;
    const input = testCase.input;
    const args =
      parameterNames.length > 0 &&
      parameterNames.every((name) => Object.prototype.hasOwnProperty.call(input, name))
        ? parameterNames.map((name) => input[name])
        : Object.values(input);
    return { ...testCase, args };
  });
}
