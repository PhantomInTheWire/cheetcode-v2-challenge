import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getLevel3ChallengeFromId } from "../server/level3/problems";
import { getLevel3AutoSolveCode } from "../server/level3/autoSolve";
import { buildLevel3NativeSandboxRunner } from "../server/level3/sandboxRunner";

function hasTool(tool: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${tool}`], { encoding: "utf8" });
  return check.status === 0;
}

const hasNativeToolchain = hasTool("clang") && hasTool("clang++") && hasTool("rustc");

function readSpec(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "server/level3/tasks/cpu-16bit-emulator/spec.md"),
    "utf8",
  );
}

function runHarness(language: "C" | "C++" | "Rust") {
  const taskId = "cpu-16bit-emulator";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3-spec-cohesion-"));
  try {
    const ext = language === "C" ? "c" : language === "C++" ? "cpp" : "rs";
    fs.writeFileSync(path.join(dir, `main.${ext}`), getLevel3AutoSolveCode(language, taskId));
    fs.writeFileSync(path.join(dir, "runner.mjs"), buildLevel3NativeSandboxRunner(taskId, language));

    const run = spawnSync("node", ["runner.mjs"], { cwd: dir, encoding: "utf8", timeout: 30_000 });
    expect(run.status, run.stderr || run.stdout || run.signal || "runner failed").toBe(0);

    return JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")) as {
      compiled: boolean;
      error: string;
      harness: Record<string, { ok: boolean; message: string }>;
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("level3 spec/harness cohesion", () => {
  it("spec declares required public API and machine model", () => {
    const spec = readSpec();

    const requiredApi = [
      "cpu_reset",
      "cpu_load_word",
      "cpu_assemble",
      "cpu_set_reg",
      "cpu_get_reg",
      "cpu_get_pc",
      "cpu_get_sp",
      "cpu_get_flag_z",
      "cpu_get_flag_n",
      "cpu_get_flag_v",
      "cpu_mem_read16",
      "cpu_run",
    ];

    for (const symbol of requiredApi) {
      expect(spec).toContain(symbol);
    }

    expect(spec).toContain("Machine Model");
    expect(spec).toContain("Instruction Encoding");
    expect(spec).toContain("Execution Semantics");
    expect(spec).toContain("Assembler Contract");
  });

  it.skipIf(!hasNativeToolchain)(
    "harness enforces declared checks and reference solutions satisfy all checks",
    () => {
      const languages = ["C", "C++", "Rust"] as const;

      for (const language of languages) {
        const languageKey = language === "C" ? "c" : language === "C++" ? "cpp" : "rust";
        const challenge = getLevel3ChallengeFromId(`l3:cpu-16bit-emulator:${languageKey}`);
        expect(challenge).not.toBeNull();

        const expectedKeys = new Set(
          (challenge?.checks ?? []).map((c) => c.id.split(":").pop() ?? ""),
        );
        const result = runHarness(language);
        expect(result.compiled, `${language} compile error: ${result.error}`).toBe(true);

        const actualKeys = new Set(Object.keys(result.harness));
        expect(actualKeys).toEqual(expectedKeys);

        for (const key of expectedKeys) {
          const check = result.harness[key];
          expect(check, `${language} missing harness output for ${key}`).toBeTruthy();
          expect(check.ok, `${language} ${key} failed: ${check.message}`).toBe(true);
          expect((check.message ?? "").trim().length).toBeGreaterThan(0);
        }
      }
    },
  );
});
