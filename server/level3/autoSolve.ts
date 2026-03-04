import { resolveLevel3TaskAssets } from "./taskAssets";

export function getLevel3AutoSolveCode(language: string, taskId: string): string {
  return resolveLevel3TaskAssets(taskId, language).solutionCode;
}
