import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getLevel3AutoSolveCode } from "../server/level3/autoSolve";
import { buildLevel3NativeSandboxRunner } from "../server/level3/sandboxRunner";
import { getLevel3ChallengeFromId } from "../server/level3/problems";

function hasTool(tool: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${tool}`], { encoding: "utf8" });
  return check.status === 0;
}

const hasNativeToolchain = hasTool("clang") && hasTool("clang++") && hasTool("rustc");

describe.skipIf(!hasNativeToolchain)("level3 autosolve native harness", () => {
  it("passes harness checks for C/C++/Rust", () => {
    const languages = ["C", "C++", "Rust"] as const;
    for (const language of languages) {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3-native-"));
      const ext = language === "C" ? "c" : language === "C++" ? "cpp" : "rs";
      const taskId = "cpu-16bit-emulator";
      fs.writeFileSync(path.join(dir, `main.${ext}`), getLevel3AutoSolveCode(language, taskId));
      fs.writeFileSync(path.join(dir, "runner.mjs"), buildLevel3NativeSandboxRunner(taskId, language));

      const run = spawnSync("node", ["runner.mjs"], { cwd: dir, encoding: "utf8" });
      expect(run.status).toBe(0);
      const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")) as {
        compiled: boolean;
        error: string;
        harness: Record<string, { ok: boolean; message: string }>;
      };
      expect(result.compiled).toBe(true);

      const languageKey = language === "C" ? "c" : language === "C++" ? "cpp" : "rust";
      const challenge = getLevel3ChallengeFromId(`l3:cpu-16bit-emulator:${languageKey}`);
      expect(challenge).not.toBeNull();
      const expectedKeys = new Set(
        (challenge?.checks ?? []).map((c) => c.id.split(":").pop() ?? ""),
      );
      const actualKeys = new Set(Object.keys(result.harness));
      expect(actualKeys).toEqual(expectedKeys);
      expect(actualKeys.size, `${language} expected check count mismatch`).toBe(
        challenge?.checks.length,
      );

      const failed = Object.entries(result.harness).filter(([, outcome]) => outcome.ok !== true);
      expect(failed, `${language} failed checks: ${JSON.stringify(failed)}`).toHaveLength(0);

      // Budget guard: benchmark thresholds must be >= ideal reference runtimes.
      const benchmarkMessage = result.harness.benchmark_budget?.message ?? "";
      const match = benchmarkMessage.match(
        /throughput=([0-9.]+)s<=([0-9.]+)s halt=([0-9.]+)s<=([0-9.]+)s/,
      );
      expect(
        match,
        `${language} benchmark message format changed: ${benchmarkMessage}`,
      ).not.toBeNull();
      const throughputElapsed = Number(match?.[1] ?? "NaN");
      const throughputBudget = Number(match?.[2] ?? "NaN");
      const haltElapsed = Number(match?.[3] ?? "NaN");
      const haltBudget = Number(match?.[4] ?? "NaN");
      expect(Number.isFinite(throughputElapsed)).toBe(true);
      expect(Number.isFinite(throughputBudget)).toBe(true);
      expect(Number.isFinite(haltElapsed)).toBe(true);
      expect(Number.isFinite(haltBudget)).toBe(true);
      expect(throughputElapsed).toBeLessThanOrEqual(throughputBudget);
      expect(haltElapsed).toBeLessThanOrEqual(haltBudget);
    }
  });
});
