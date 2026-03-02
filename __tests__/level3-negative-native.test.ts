import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildCpuNativeSandboxRunner } from "../server/level3/sandboxRunner";

function hasTool(tool: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${tool}`], { encoding: "utf8" });
  return check.status === 0;
}

const hasNativeToolchain = hasTool("clang");

function runC(code: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3-negative-"));
  try {
    fs.writeFileSync(path.join(dir, "main.c"), code);
    fs.writeFileSync(path.join(dir, "runner.mjs"), buildCpuNativeSandboxRunner("C"));

    const run = spawnSync("node", ["runner.mjs"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 15_000,
    });
    expect(run.status, run.stderr || run.stdout || run.signal || "spawn failed").toBe(0);

    return JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")) as {
      compiled: boolean;
      error: string;
      harness: Record<string, { ok: boolean; message: string }>;
    };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const BASE_EXPORTS = `
__attribute__((visibility("default"))) void cpu_reset(void) {}
__attribute__((visibility("default"))) void cpu_load_word(int addr, int word) {(void)addr;(void)word;}
__attribute__((visibility("default"))) void cpu_set_reg(int idx, int value) {(void)idx;(void)value;}
__attribute__((visibility("default"))) int cpu_get_reg(int idx) {(void)idx; return 0;}
__attribute__((visibility("default"))) int cpu_get_pc(void) { return 0; }
__attribute__((visibility("default"))) int cpu_get_sp(void) { return 0xFFFF; }
__attribute__((visibility("default"))) int cpu_get_flag_z(void) { return 0; }
__attribute__((visibility("default"))) int cpu_get_flag_n(void) { return 0; }
__attribute__((visibility("default"))) int cpu_mem_read16(int addr) {(void)addr; return 0;}
`;

describe.skipIf(!hasNativeToolchain)("level3 negative native harness checks", () => {
  it("fails assembler-related checks when assembler always errors", () => {
    const code = `${BASE_EXPORTS}
__attribute__((visibility("default"))) int cpu_assemble(const char* src, int src_len, unsigned short* out_words, int max_words) {
  (void)src; (void)src_len; (void)out_words; (void)max_words;
  return -1;
}
__attribute__((visibility("default"))) int cpu_get_flag_v(void) { return 0; }
__attribute__((visibility("default"))) int cpu_run(int max_cycles) {(void)max_cycles; return 0;}
`;

    const result = runC(code);
    expect(result.compiled, result.error).toBe(true);
    expect(result.harness.programs_asm1?.ok).toBe(false);
    expect(result.harness.programs_invalid_reject?.ok).toBe(false);
  });

  it("fails logic_v_clear when V flag is incorrectly stuck high", () => {
    const code = `${BASE_EXPORTS}
__attribute__((visibility("default"))) int cpu_assemble(const char* src, int src_len, unsigned short* out_words, int max_words) {
  (void)src; (void)src_len; (void)out_words; (void)max_words;
  return -1;
}
__attribute__((visibility("default"))) int cpu_get_flag_v(void) { return 1; }
__attribute__((visibility("default"))) int cpu_run(int max_cycles) {(void)max_cycles; return 1;}
`;

    const result = runC(code);
    expect(result.compiled, result.error).toBe(true);
    expect(result.harness.logic_v_clear?.ok).toBe(false);
  });

  it("fails benchmark/cycle checks when cpu_run reports zero work", () => {
    const code = `${BASE_EXPORTS}
__attribute__((visibility("default"))) int cpu_assemble(const char* src, int src_len, unsigned short* out_words, int max_words) {
  (void)src; (void)src_len; (void)out_words; (void)max_words;
  return -1;
}
__attribute__((visibility("default"))) int cpu_get_flag_v(void) { return 0; }
__attribute__((visibility("default"))) int cpu_run(int max_cycles) {(void)max_cycles; return 0;}
`;

    const result = runC(code);
    expect(result.compiled, result.error).toBe(true);
    expect(result.harness.benchmark_budget?.ok).toBe(false);
  });
});
