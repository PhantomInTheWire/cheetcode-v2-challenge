type ValidationStatus = "failed" | "partial" | "passed";

type ValidationStatsInput = {
  passCount: number;
  totalCount: number;
};

export type ValidationResponseMeta = ValidationStatsInput & {
  status: ValidationStatus;
  failCount: number;
  passed: boolean;
};

export function summarizeValidation({
  passCount,
  totalCount,
}: ValidationStatsInput): ValidationResponseMeta {
  const failCount = Math.max(0, totalCount - passCount);
  const status =
    passCount <= 0 ? "failed" : passCount >= totalCount && totalCount > 0 ? "passed" : "partial";
  return {
    status,
    passCount,
    totalCount,
    failCount,
    passed: status === "passed",
  };
}
