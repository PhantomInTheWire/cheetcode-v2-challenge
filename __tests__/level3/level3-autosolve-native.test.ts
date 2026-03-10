import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getLevel3AutoSolveCode } from "../../server/level3/autoSolve";
import { buildLevel3NativeSandboxRunner } from "../../server/level3/sandboxRunner";
import { getLevel3ChallengeFromId } from "../../server/level3/problems";
import { LEVEL3_ENABLED_TASKS } from "../../server/level3/taskCatalog";

function hasTool(tool: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${tool}`], { encoding: "utf8" });
  return check.status === 0;
}

const hasNativeToolchain = hasTool("clang") && hasTool("clang++") && hasTool("rustc");

describe.skipIf(!hasNativeToolchain)("level3 autosolve native harness", () => {
  it("passes harness checks for the auth resolver across C/C++/Rust", () => {
    const languages = ["C", "C++", "Rust"] as const;
    const authTask = LEVEL3_ENABLED_TASKS.find(
      (task) => task.id === "identity-bundle-auth-resolver",
    );
    expect(authTask).toBeTruthy();
    for (const task of [authTask!]) {
      for (const language of languages) {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3-native-"));
        const ext = language === "C" ? "c" : language === "C++" ? "cpp" : "rs";
        fs.writeFileSync(path.join(dir, `main.${ext}`), getLevel3AutoSolveCode(language, task.id));
        fs.writeFileSync(
          path.join(dir, "runner.mjs"),
          buildLevel3NativeSandboxRunner(task.id, language),
        );

        const run = spawnSync("node", ["runner.mjs"], { cwd: dir, encoding: "utf8" });
        expect(run.status).toBe(0);
        const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")) as {
          compiled: boolean;
          error: string;
          harness: Record<string, { ok: boolean; message: string }>;
        };
        expect(result.compiled).toBe(true);

        const languageKey = language === "C" ? "c" : language === "C++" ? "cpp" : "rust";
        const challenge = getLevel3ChallengeFromId(`l3:${task.id}:${languageKey}`);
        expect(challenge).not.toBeNull();
        const expectedKeys = new Set(
          (challenge?.checks ?? []).map((c) => c.id.split(":").pop() ?? ""),
        );
        const actualKeys = new Set(Object.keys(result.harness));
        expect(actualKeys).toEqual(expectedKeys);
        expect(actualKeys.size, `${task.id}/${language} expected check count mismatch`).toBe(
          challenge?.checks.length,
        );

        const failed = Object.entries(result.harness).filter(([, outcome]) => outcome.ok !== true);
        expect(
          failed,
          `${task.id}/${language} failed checks: ${JSON.stringify(failed)}`,
        ).toHaveLength(0);

        for (const [key, outcome] of Object.entries(result.harness)) {
          expect(
            (outcome.message ?? "").trim().length,
            `${task.id}/${language} ${key} message missing`,
          ).toBeGreaterThan(0);
        }

        expect(
          (result.harness.scale_large_trace_equivalence_budget?.message ?? "").trim().length,
        ).toBeGreaterThan(0);
      }
    }
  });
});
