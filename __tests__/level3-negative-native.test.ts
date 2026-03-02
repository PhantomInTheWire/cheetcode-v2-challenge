import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getLevel3AutoSolveCode } from "../server/level3/autoSolve";
import { buildCpuNativeSandboxRunner } from "../server/level3/sandboxRunner";

function hasTool(tool: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${tool}`], { encoding: "utf8" });
  return check.status === 0;
}

const hasNativeToolchain = hasTool("clang");

function runC(code: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3-negative-"));
  fs.writeFileSync(path.join(dir, "main.c"), code);
  fs.writeFileSync(path.join(dir, "runner.mjs"), buildCpuNativeSandboxRunner("C"));

  const run = spawnSync("node", ["runner.mjs"], { cwd: dir, encoding: "utf8" });
  expect(run.status).toBe(0);

  return JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")) as {
    compiled: boolean;
    error: string;
    harness: Record<string, { ok: boolean; message: string }>;
  };
}

describe.skipIf(!hasNativeToolchain)("level3 negative native harness checks", () => {
  it("fails assembler-related checks when cpu_assemble is intentionally broken", () => {
    const base = getLevel3AutoSolveCode("C");
    const mutated = base.replace(
      /__attribute__\(\(visibility\("default"\)\)\) int cpu_assemble[\s\S]*?\n\}/,
      `__attribute__((visibility("default"))) int cpu_assemble(const char* src, int src_len, unsigned short* out_words, int max_words) {
  (void)src; (void)src_len; (void)out_words; (void)max_words;
  return -1;
}`,
    );

    const result = runC(mutated);
    expect(result.compiled, result.error).toBe(true);
    expect(result.harness.programs_asm1?.ok).toBe(false);
    expect(result.harness.programs_asm2?.ok).toBe(false);
    expect(result.harness.programs_asm3?.ok).toBe(false);
    expect(result.harness.programs_asm4?.ok).toBe(false);
    expect(result.harness.programs_invalid_reject?.ok).toBe(false);
  });

  it("fails logic_v_clear when logical ops stop clearing V", () => {
    const base = getLevel3AutoSolveCode("C");
    const mutated = base.replace(
      /static void set_logic_flags\(unsigned short r\) \{[\s\S]*?\n\}/,
      `static void set_logic_flags(unsigned short r) {
  set_zn(r);
  flag_v = 1;
}`,
    );
    const result = runC(mutated);
    expect(result.compiled, result.error).toBe(true);
    expect(result.harness.logic_v_clear?.ok).toBe(false);
  });

  it("fails benchmark/cycle checks when cpu_run ignores max_cycles", () => {
    const base = getLevel3AutoSolveCode("C");
    const mutated = base.replace("while (cycles < max_cycles && !halted) {", "while (0) {");
    const result = runC(mutated);
    expect(result.compiled, result.error).toBe(true);
    expect(result.harness.benchmark_budget?.ok).toBe(false);
  });
});
