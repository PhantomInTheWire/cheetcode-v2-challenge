export function buildCpuNativeSandboxRunner(language: string): string {
  return `
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const language = ${JSON.stringify(language)};

const HARNESS_SOURCE = String.raw\`
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif
void cpu_reset(void);
void cpu_load_word(int addr, int word);
void cpu_set_reg(int idx, int value);
int cpu_get_reg(int idx);
int cpu_get_pc(void);
int cpu_get_sp(void);
int cpu_get_flag_z(void);
int cpu_get_flag_n(void);
int cpu_get_flag_v(void);
int cpu_mem_read16(int addr);
int cpu_run(int max_cycles);
#ifdef __cplusplus
}
#endif

enum {
  OPC_NOP = 0x00, OPC_LOAD = 0x01, OPC_MOV = 0x02, OPC_ADD = 0x03, OPC_SUB = 0x04,
  OPC_AND = 0x05, OPC_OR = 0x06, OPC_XOR = 0x07, OPC_NOT = 0x08, OPC_SHL = 0x09,
  OPC_SHR = 0x0A, OPC_CMP = 0x0B, OPC_JMP = 0x0C, OPC_JZ = 0x0D, OPC_JNZ = 0x0E,
  OPC_JN = 0x0F, OPC_LDR = 0x10, OPC_STR = 0x11, OPC_PUSH = 0x12, OPC_POP = 0x13,
  OPC_CALL = 0x14, OPC_RET = 0x15, OPC_HALT = 0x16
};

typedef struct {
  int ok;
  char msg[200];
} Check;

static uint16_t encR(int op, int dst, int src, int imm5) {
  return (uint16_t)(((op & 0x1F) << 11) | ((dst & 7) << 8) | ((src & 7) << 5) | (imm5 & 0x1F));
}

static uint16_t encJ(int op, int addr) {
  return (uint16_t)(((op & 0x1F) << 11) | (addr & 0x7FF));
}

static uint16_t encX(int op, int dst) {
  return (uint16_t)(((op & 0x1F) << 11) | ((dst & 7) << 8));
}

static void load_program(const uint16_t *program, int len) {
  cpu_reset();
  for (int i = 0; i < len; i++) {
    cpu_load_word(i * 2, program[i]);
  }
}

static uint16_t lcg_next(uint32_t *state) {
  *state = (*state * 1664525u) + 1013904223u;
  return (uint16_t)((*state >> 8) & 0xFFFFu);
}

static int add_overflow(uint16_t a, uint16_t b, uint16_t r) {
  return (((a ^ r) & (b ^ r) & 0x8000u) != 0u) ? 1 : 0;
}

static int sub_overflow(uint16_t a, uint16_t b, uint16_t r) {
  return (((a ^ b) & (a ^ r) & 0x8000u) != 0u) ? 1 : 0;
}

int main(void) {
  Check abi = {0, ""};
  Check arith = {0, ""};
  Check logic = {0, ""};
  Check branch = {0, ""};
  Check stack = {0, ""};
  Check memory = {0, ""};
  Check programs = {0, ""};
  Check random = {0, ""};
  Check benchmark = {0, ""};

  cpu_reset();
  if (cpu_get_sp() == 0xFFFF && cpu_get_pc() == 0 && cpu_get_reg(0) == 0 &&
      cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 0) {
    abi.ok = 1;
    snprintf(abi.msg, sizeof(abi.msg), "reset/ABI ok");
  } else {
    snprintf(abi.msg, sizeof(abi.msg), "bad reset state");
  }

  {
    // ADD overflow + SUB overflow + CMP no-write + flags for arithmetic.
    uint16_t program[] = {
      encX(OPC_LOAD, 0), 0x7FFF,
      encX(OPC_LOAD, 1), 1,
      encR(OPC_ADD, 0, 1, 0),
      encX(OPC_LOAD, 2), 0x8000,
      encX(OPC_LOAD, 3), 1,
      encR(OPC_SUB, 2, 3, 0),
      encX(OPC_LOAD, 4), 5,
      encX(OPC_LOAD, 5), 6,
      encR(OPC_CMP, 4, 5, 0),
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(400);
    int add_ok = ((cpu_get_reg(0) & 0xFFFF) == 0x8000);
    // After CMP(5-6) => 0xFFFF, Z=0 N=1 V=0
    int cmp_ok = ((cpu_get_reg(4) & 0xFFFF) == 5) && ((cpu_get_reg(5) & 0xFFFF) == 6);
    int flags_ok = (cpu_get_flag_z() == 0 && cpu_get_flag_n() == 1 && cpu_get_flag_v() == 0);

    // Dedicated ADD flag check
    uint16_t add_prog[] = {
      encX(OPC_LOAD, 0), 0x7FFF,
      encX(OPC_LOAD, 1), 1,
      encR(OPC_ADD, 0, 1, 0),
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(add_prog, (int)(sizeof(add_prog) / sizeof(add_prog[0])));
    cpu_run(100);
    int add_flags_ok = (cpu_get_flag_z() == 0 && cpu_get_flag_n() == 1 && cpu_get_flag_v() == 1);

    // Dedicated SUB overflow check: 0x8000 - 1 => 0x7FFF, V=1
    uint16_t sub_prog[] = {
      encX(OPC_LOAD, 0), 0x8000,
      encX(OPC_LOAD, 1), 1,
      encR(OPC_SUB, 0, 1, 0),
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(sub_prog, (int)(sizeof(sub_prog) / sizeof(sub_prog[0])));
    cpu_run(100);
    int sub_flags_ok = ((cpu_get_reg(0) & 0xFFFF) == 0x7FFF) &&
      (cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 1);

    if (add_ok && cmp_ok && flags_ok && add_flags_ok && sub_flags_ok) {
      arith.ok = 1;
      snprintf(arith.msg, sizeof(arith.msg), "arithmetic flags ok");
    } else {
      snprintf(arith.msg, sizeof(arith.msg), "arith failure");
    }
  }

  {
    // Logical/shift ops set Z/N and clear V, data movement should keep flags unchanged.
    uint16_t program[] = {
      encX(OPC_LOAD, 0), 0x00F0,
      encX(OPC_LOAD, 1), 0x0F00,
      encR(OPC_AND, 0, 1, 0), // -> 0x0000 Z=1 N=0 V=0
      encR(OPC_OR, 0, 1, 0),  // -> 0x0F00 Z=0 N=0 V=0
      encR(OPC_XOR, 0, 1, 0), // -> 0x0000 Z=1 N=0 V=0
      encR(OPC_NOT, 0, 0, 0), // -> 0xFFFF Z=0 N=1 V=0
      encR(OPC_SHR, 0, 0, 1), // -> 0x7FFF Z=0 N=0 V=0
      encR(OPC_SHL, 0, 0, 1), // -> 0xFFFE Z=0 N=1 V=0
      encR(OPC_MOV, 2, 0, 0), // flags unaffected
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(500);
    int ok = ((cpu_get_reg(0) & 0xFFFF) == 0xFFFE) &&
      ((cpu_get_reg(2) & 0xFFFF) == 0xFFFE) &&
      cpu_get_flag_z() == 0 && cpu_get_flag_n() == 1 && cpu_get_flag_v() == 0;
    if (ok) {
      logic.ok = 1;
      snprintf(logic.msg, sizeof(logic.msg), "logic/shift flags ok");
    } else {
      snprintf(logic.msg, sizeof(logic.msg), "logic/shift mismatch");
    }
  }

  {
    // Branching: sum 10..1 using JNZ and CMP
    uint16_t program[] = {
      encX(OPC_LOAD, 0), 0,
      encX(OPC_LOAD, 1), 10,
      encX(OPC_LOAD, 2), 1,
      encX(OPC_LOAD, 3), 0,
      encR(OPC_ADD, 0, 1, 0),
      encR(OPC_SUB, 1, 2, 0),
      encR(OPC_CMP, 1, 3, 0),
      encJ(OPC_JNZ, 16),
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(3000);
    int r0 = cpu_get_reg(0) & 0xFFFF;
    if (r0 == 55) {
      branch.ok = 1;
      snprintf(branch.msg, sizeof(branch.msg), "branch loop ok");
    } else {
      snprintf(branch.msg, sizeof(branch.msg), "expected 55 got %d", r0);
    }
  }

  {
    // Stack + CALL/RET + nested call discipline
    uint16_t program[] = {
      encX(OPC_LOAD, 0), 10,
      encX(OPC_LOAD, 7), 2,
      encX(OPC_CALL, 0), 18,
      encR(OPC_PUSH, 0, 0, 0),
      encR(OPC_POP, 1, 0, 0),
      encR(OPC_HALT, 0, 0, 0),

      // sub1 @ 18
      encX(OPC_LOAD, 2), 5,
      encR(OPC_ADD, 0, 2, 0),
      encX(OPC_CALL, 0), 30,
      encR(OPC_RET, 0, 0, 0),

      // sub2 @ 30
      encR(OPC_ADD, 0, 7, 0),
      encR(OPC_RET, 0, 0, 0)
    };
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(4000);
    int sp = cpu_get_sp() & 0xFFFF;
    int r0 = cpu_get_reg(0) & 0xFFFF;
    int r1 = cpu_get_reg(1) & 0xFFFF;
    if (sp == 0xFFFF && r0 == 17 && r1 == 17) {
      stack.ok = 1;
      snprintf(stack.msg, sizeof(stack.msg), "stack/call/ret ok");
    } else {
      snprintf(stack.msg, sizeof(stack.msg), "expected sp=65535 r0=r1=17 got sp=%d r0=%d r1=%d", sp, r0, r1);
    }
  }

  {
    // Memory: little-endian, unaligned access, and wraparound at 0xFFFF.
    uint16_t program[] = {
      encX(OPC_LOAD, 0), 0xABCD,
      encX(OPC_LOAD, 1), 0xFFFF,
      encR(OPC_STR, 1, 0, 0),
      encR(OPC_LDR, 2, 1, 0),
      encX(OPC_LOAD, 3), 0x1357,
      encX(OPC_LOAD, 4), 1,
      encR(OPC_STR, 4, 3, 0),
      encR(OPC_LDR, 5, 4, 0),
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(1000);

    int wrap = cpu_mem_read16(0xFFFF) & 0xFFFF;
    int unaligned = cpu_mem_read16(1) & 0xFFFF;
    int r2 = cpu_get_reg(2) & 0xFFFF;
    int r5 = cpu_get_reg(5) & 0xFFFF;

    if (wrap == 0xABCD && unaligned == 0x1357 && r2 == 0xABCD && r5 == 0x1357) {
      memory.ok = 1;
      snprintf(memory.msg, sizeof(memory.msg), "memory semantics ok");
    } else {
      snprintf(memory.msg, sizeof(memory.msg), "memory mismatch w=%d u=%d r2=%d r5=%d", wrap, unaligned, r2, r5);
    }
  }

  {
    // Deterministic end-to-end program touching multiple opclasses.
    uint16_t program[] = {
      encX(OPC_LOAD, 0), 3,
      encX(OPC_LOAD, 1), 4,
      encR(OPC_ADD, 0, 1, 0),
      encR(OPC_SHL, 0, 0, 3),
      encX(OPC_LOAD, 2), 7,
      encR(OPC_XOR, 0, 2, 0),
      encX(OPC_LOAD, 3), 1000,
      encR(OPC_STR, 3, 0, 0),
      encR(OPC_LDR, 4, 3, 0),
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    int cycles = cpu_run(1000);
    int r0 = cpu_get_reg(0) & 0xFFFF;
    int r4 = cpu_get_reg(4) & 0xFFFF;
    int m = cpu_mem_read16(1000) & 0xFFFF;
    if (cycles > 0 && r0 == 63 && r4 == 63 && m == 63) {
      programs.ok = 1;
      snprintf(programs.msg, sizeof(programs.msg), "deterministic program ok");
    } else {
      snprintf(programs.msg, sizeof(programs.msg), "program mismatch cycles=%d r0=%d r4=%d mem=%d", cycles, r0, r4, m);
    }
  }

  {
    // Randomized ALU property checks for result + Z/N/V formulas.
    int pass = 0;
    const int total = 120;
    uint32_t seed = 0xC0FFEEu;
    for (int i = 0; i < total; i++) {
      uint16_t a = lcg_next(&seed);
      uint16_t b = lcg_next(&seed);

      uint16_t add_expected = (uint16_t)(a + b);
      int addZ = add_expected == 0 ? 1 : 0;
      int addN = (add_expected & 0x8000u) ? 1 : 0;
      int addV = add_overflow(a, b, add_expected);

      uint16_t add_prog[] = {
        encX(OPC_LOAD, 0), a,
        encX(OPC_LOAD, 1), b,
        encR(OPC_ADD, 0, 1, 0),
        encR(OPC_HALT, 0, 0, 0)
      };
      load_program(add_prog, (int)(sizeof(add_prog) / sizeof(add_prog[0])));
      cpu_run(200);
      int gotAdd = cpu_get_reg(0) & 0xFFFF;
      int gotZ = cpu_get_flag_z() ? 1 : 0;
      int gotN = cpu_get_flag_n() ? 1 : 0;
      int gotV = cpu_get_flag_v() ? 1 : 0;
      if (!(gotAdd == add_expected && gotZ == addZ && gotN == addN && gotV == addV)) continue;

      uint16_t sub_expected = (uint16_t)(a - b);
      int subZ = sub_expected == 0 ? 1 : 0;
      int subN = (sub_expected & 0x8000u) ? 1 : 0;
      int subV = sub_overflow(a, b, sub_expected);

      uint16_t sub_prog[] = {
        encX(OPC_LOAD, 0), a,
        encX(OPC_LOAD, 1), b,
        encR(OPC_SUB, 0, 1, 0),
        encR(OPC_HALT, 0, 0, 0)
      };
      load_program(sub_prog, (int)(sizeof(sub_prog) / sizeof(sub_prog[0])));
      cpu_run(200);
      int gotSub = cpu_get_reg(0) & 0xFFFF;
      gotZ = cpu_get_flag_z() ? 1 : 0;
      gotN = cpu_get_flag_n() ? 1 : 0;
      gotV = cpu_get_flag_v() ? 1 : 0;
      if (gotSub == sub_expected && gotZ == subZ && gotN == subN && gotV == subV) pass++;
    }
    if (pass == total) {
      random.ok = 1;
      snprintf(random.msg, sizeof(random.msg), "randomized ALU ok");
    } else {
      snprintf(random.msg, sizeof(random.msg), "randomized ALU failed %d/%d", pass, total);
    }
  }

  {
    // Benchmark: non-halting tight loop should execute max_cycles under a loose time cap.
    uint16_t program[] = {
      encX(OPC_LOAD, 0), 1,
      encX(OPC_LOAD, 1), 1,
      encR(OPC_ADD, 0, 1, 0),
      encJ(OPC_JMP, 8)
    };
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    const int max_cycles = 300000;
    clock_t t0 = clock();
    int executed = cpu_run(max_cycles);
    clock_t t1 = clock();
    double elapsed = (double)(t1 - t0) / (double)CLOCKS_PER_SEC;
    if (executed == max_cycles && elapsed < 2.5) {
      benchmark.ok = 1;
      snprintf(benchmark.msg, sizeof(benchmark.msg), "benchmark ok (%.3fs)", elapsed);
    } else {
      snprintf(benchmark.msg, sizeof(benchmark.msg), "benchmark failed cycles=%d elapsed=%.3f", executed, elapsed);
    }
  }

  printf("abi|%d|%s\\n", abi.ok, abi.msg);
  printf("arith|%d|%s\\n", arith.ok, arith.msg);
  printf("logic|%d|%s\\n", logic.ok, logic.msg);
  printf("branch|%d|%s\\n", branch.ok, branch.msg);
  printf("stack|%d|%s\\n", stack.ok, stack.msg);
  printf("memory|%d|%s\\n", memory.ok, memory.msg);
  printf("programs|%d|%s\\n", programs.ok, programs.msg);
  printf("random|%d|%s\\n", random.ok, random.msg);
  printf("benchmark|%d|%s\\n", benchmark.ok, benchmark.msg);
  return 0;
}
\`;

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8" });
}

function compileAndRun() {
  fs.writeFileSync("harness.c", HARNESS_SOURCE, "utf8");

  let compileResult;
  if (language === "C") {
    compileResult = run("clang", ["-O2", "main.c", "harness.c", "-o", "harness"]);
  } else if (language === "C++") {
    compileResult = run("clang++", ["-O2", "main.cpp", "harness.c", "-o", "harness"]);
  } else {
    const lib = run("rustc", ["--crate-type", "staticlib", "-O", "main.rs", "-o", "libuser.a"]);
    if (lib.status !== 0) return { compileResult: lib, runResult: null };
    compileResult = run("clang", ["-O2", "harness.c", "libuser.a", "-o", "harness", "-lpthread", "-ldl", "-lm"]);
  }

  if (compileResult.status !== 0) return { compileResult, runResult: null };
  const runResult = run("./harness", []);
  return { compileResult, runResult };
}

function parseHarnessOutput(output) {
  const harness = {};
  for (const line of output.split(/\\r?\\n/)) {
    if (!line.trim()) continue;
    const [key, okText, ...rest] = line.split("|");
    harness[key] = { ok: okText === "1", message: rest.join("|") || "no message" };
  }
  return harness;
}

const { compileResult, runResult } = compileAndRun();
if (!compileResult || compileResult.status !== 0) {
  fs.writeFileSync("result.json", JSON.stringify({
    compiled: false,
    error: (compileResult?.stderr || compileResult?.stdout || "compile failed").toString().slice(0, 4000),
    harness: {}
  }), "utf8");
  process.exit(0);
}

if (!runResult || runResult.status !== 0) {
  fs.writeFileSync("result.json", JSON.stringify({
    compiled: false,
    error: (runResult?.stderr || runResult?.stdout || "harness failed").toString().slice(0, 4000),
    harness: {}
  }), "utf8");
  process.exit(0);
}

fs.writeFileSync("result.json", JSON.stringify({
  compiled: true,
  error: "",
  harness: parseHarnessOutput(runResult.stdout || "")
}), "utf8");
`.trim();
}
