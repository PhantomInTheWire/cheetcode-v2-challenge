import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getLevel3ChallengeFromId } from "../server/level3/problems";
import { getLevel3AutoSolveCode } from "../server/level3/autoSolve";
import { buildCpuNativeSandboxRunner } from "../server/level3/sandboxRunner";

function hasTool(tool: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${tool}`], { encoding: "utf8" });
  return check.status === 0;
}

const hasNativeToolchain = hasTool("clang") && hasTool("clang++") && hasTool("rustc");

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function runHarness(language: "C" | "C++" | "Rust") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3-spec-matrix-"));
  const ext = language === "C" ? "c" : language === "C++" ? "cpp" : "rs";
  fs.writeFileSync(path.join(dir, `main.${ext}`), getLevel3AutoSolveCode(language));
  fs.writeFileSync(path.join(dir, "runner.mjs"), buildCpuNativeSandboxRunner(language));

  const run = spawnSync("node", ["runner.mjs"], { cwd: dir, encoding: "utf8" });
  expect(run.status).toBe(0);
  const result = JSON.parse(fs.readFileSync(path.join(dir, "result.json"), "utf8")) as {
    compiled: boolean;
    error: string;
    harness: Record<string, { ok: boolean; message: string }>;
  };
  return result;
}

describe("level3 spec matrix", () => {
  it("maps all spec semantic bullets to explicit checks/harness sections", () => {
    const spec = read("server/level3/assets/spec.md");
    const harness = read("server/level3/assets/harness.c");
    const challenge = getLevel3ChallengeFromId("l3:cpu-16bit-emulator:c");
    expect(challenge).not.toBeNull();

    const keys = new Set((challenge?.checks ?? []).map((c) => c.id.split(":").pop() ?? ""));

    const matrix: Array<{ clause: string; needs: string[]; harnessNeeds?: string[] }> = [
      {
        clause: "LOAD/MOV/LDR/STR/PUSH/POP do not modify flags.",
        needs: ["logic_bitwise", "stack_push_pop", "memory_unaligned"],
        harnessNeeds: ["encR(OPC_MOV", "encR(OPC_PUSH", "encR(OPC_POP", "encR(OPC_LDR", "encR(OPC_STR"],
      },
      {
        clause: "ADD/SUB/CMP update Z,N,V (V uses signed overflow formulas).",
        needs: ["arith_add_overflow", "arith_sub_overflow", "arith_cmp_flags", "random_alu"],
        harnessNeeds: ["add_overflow(", "sub_overflow(", "encR(OPC_CMP"],
      },
      {
        clause: "AND/OR/XOR/NOT/SHL/SHR update Z,N and clear V.",
        needs: ["logic_bitwise", "logic_shifts", "logic_v_clear"],
        harnessNeeds: ["encR(OPC_AND", "encR(OPC_OR", "encR(OPC_XOR", "encR(OPC_NOT", "encR(OPC_SHL", "encR(OPC_SHR"],
      },
      {
        clause: "SHL/SHR shift amount is imm5 mod 16.",
        needs: ["logic_shifts"],
        harnessNeeds: ["encR(OPC_SHR", "encR(OPC_SHL"],
      },
      {
        clause: "PUSH: SP-=2; [SP]=word. POP: Rd=[SP]; SP+=2.",
        needs: ["stack_push_pop"],
      },
      {
        clause: "CALL pushes return PC (instruction after CALL), then sets PC=imm16.",
        needs: ["stack_call_ret", "programs_asm3"],
      },
      {
        clause: "RET pops PC from stack.",
        needs: ["stack_call_ret", "programs_asm3"],
      },
      {
        clause: "Memory: 64KB byte-addressable, little-endian word layout, no alignment requirement.",
        needs: ["memory_wraparound", "memory_unaligned"],
        harnessNeeds: ["cpu_mem_read16(0xFFFF)", "cpu_mem_read16(1)"],
      },
      {
        clause: "Address arithmetic wraps modulo 2^16.",
        needs: ["memory_wraparound"],
      },
      {
        clause: "Hidden harness also assembles text assembly programs through cpu_assemble(...) and then executes them.",
        needs: ["programs_asm1", "programs_asm2", "programs_asm3", "programs_asm4", "programs_invalid_reject"],
        harnessNeeds: ["assemble_program(asm_program1", "assemble_program(asm_program4", "invalid_program"],
      },
      {
        clause: "randomized property tests, and benchmark constraints.",
        needs: ["benchmark_budget"],
        harnessNeeds: ["throughput_cycles", "expected_halt_cycles"],
      },
    ];

    for (const row of matrix) {
      expect(spec).toContain(row.clause);
      for (const key of row.needs) {
        expect(keys.has(key), `${row.clause} missing check ${key}`).toBe(true);
      }
      for (const token of row.harnessNeeds ?? []) {
        expect(harness).toContain(token);
      }
    }
  });

  it.skipIf(!hasNativeToolchain)("executes all declared checks across C/C++/Rust and every key passes on reference solution", () => {
    const languages = ["C", "C++", "Rust"] as const;

    for (const language of languages) {
      const result = runHarness(language);
      expect(result.compiled, `${language} compile error: ${result.error}`).toBe(true);

      const languageKey = language === "C" ? "c" : language === "C++" ? "cpp" : "rust";
      const challenge = getLevel3ChallengeFromId(`l3:cpu-16bit-emulator:${languageKey}`);
      expect(challenge).not.toBeNull();

      const expectedKeys = new Set((challenge?.checks ?? []).map((c) => c.id.split(":").pop() ?? ""));
      const actualKeys = new Set(Object.keys(result.harness));

      expect(actualKeys).toEqual(expectedKeys);

      for (const key of expectedKeys) {
        const out = result.harness[key];
        expect(out, `${language} missing harness output for ${key}`).toBeTruthy();
        expect(out.ok, `${language} ${key} failed: ${out.message}`).toBe(true);
        expect((out.message ?? "").trim().length, `${language} ${key} has empty message`).toBeGreaterThan(0);
      }
    }
  });

  it("starter templates are consistent with unaligned byte-addressable memory requirement", () => {
    const starters = [
      read("server/level3/assets/main.c"),
      read("server/level3/assets/main.cpp"),
      read("server/level3/assets/main.rs"),
    ];

    for (const starter of starters) {
      expect(starter).not.toContain("(addr & 1)");
    }
  });
});
