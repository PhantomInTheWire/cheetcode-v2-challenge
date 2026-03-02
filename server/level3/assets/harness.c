#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <stdlib.h>

#ifdef __cplusplus
extern "C" {
#endif
void cpu_reset(void);
void cpu_load_word(int addr, int word);
int cpu_assemble(const char* src, int src_len, uint16_t* out_words, int max_words) __attribute__((weak));
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

enum {
  ASM_MAX_SOURCE_BYTES = 65536,
  ASM_MAX_WORDS = 32768
};

static int assemble_program(const char *src, uint16_t *out_words, int max_words, char *err, size_t err_len) {
  if (!src || !out_words || max_words <= 0) {
    snprintf(err, err_len, "invalid assembler args");
    return -1;
  }
  size_t src_len = strlen(src);
  if (src_len > ASM_MAX_SOURCE_BYTES) {
    snprintf(err, err_len, "assembly too large: %zu bytes", src_len);
    return -1;
  }
  int capped_words = max_words > ASM_MAX_WORDS ? ASM_MAX_WORDS : max_words;
  if (!cpu_assemble) {
    snprintf(err, err_len, "missing cpu_assemble export");
    return -1;
  }
  int written = cpu_assemble(src, (int)src_len, out_words, capped_words);
  if (written < 0) {
    snprintf(err, err_len, "cpu_assemble returned error %d", written);
    return -1;
  }
  if (written > capped_words) {
    snprintf(err, err_len, "cpu_assemble overflow: %d > %d", written, capped_words);
    return -1;
  }
  return written;
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
  Check abi_reset = {0, ""};
  Check arith_add_overflow = {0, ""};
  Check arith_sub_overflow = {0, ""};
  Check arith_cmp_flags = {0, ""};
  Check logic_bitwise = {0, ""};
  Check logic_shifts = {0, ""};
  Check logic_v_clear = {0, ""};
  Check branch_jnz_loop = {0, ""};
  Check branch_jn_taken = {0, ""};
  Check stack_push_pop = {0, ""};
  Check stack_call_ret = {0, ""};
  Check memory_wraparound = {0, ""};
  Check memory_unaligned = {0, ""};
  Check programs_asm1 = {0, ""};
  Check programs_asm2 = {0, ""};
  Check programs_asm3 = {0, ""};
  Check programs_asm4 = {0, ""};
  Check programs_invalid_reject = {0, ""};
  Check random_alu = {0, ""};
  Check benchmark_budget = {0, ""};

  cpu_reset();
  if (cpu_get_sp() == 0xFFFF && cpu_get_pc() == 0 && cpu_get_reg(0) == 0 &&
      cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 0) {
    abi_reset.ok = 1;
    snprintf(abi_reset.msg, sizeof(abi_reset.msg), "reset/ABI ok");
  } else {
    snprintf(abi_reset.msg, sizeof(abi_reset.msg), "bad reset state");
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

    if (add_ok && add_flags_ok) {
      arith_add_overflow.ok = 1;
      snprintf(arith_add_overflow.msg, sizeof(arith_add_overflow.msg), "add overflow ok");
    } else {
      snprintf(arith_add_overflow.msg, sizeof(arith_add_overflow.msg), "add overflow mismatch");
    }

    if (sub_flags_ok) {
      arith_sub_overflow.ok = 1;
      snprintf(arith_sub_overflow.msg, sizeof(arith_sub_overflow.msg), "sub overflow ok");
    } else {
      snprintf(arith_sub_overflow.msg, sizeof(arith_sub_overflow.msg), "sub overflow mismatch");
    }

    if (cmp_ok && flags_ok) {
      arith_cmp_flags.ok = 1;
      snprintf(arith_cmp_flags.msg, sizeof(arith_cmp_flags.msg), "cmp flags ok");
    } else {
      snprintf(arith_cmp_flags.msg, sizeof(arith_cmp_flags.msg), "cmp flags mismatch");
    }
  }

  {
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
    int bitwise_ok = ((cpu_get_reg(0) & 0xFFFF) == 0xFFFE) &&
      ((cpu_get_reg(2) & 0xFFFF) == 0xFFFE) &&
      cpu_get_flag_z() == 0 && cpu_get_flag_n() == 1 && cpu_get_flag_v() == 0;
    if (bitwise_ok) {
      logic_bitwise.ok = 1;
      snprintf(logic_bitwise.msg, sizeof(logic_bitwise.msg), "logic bitwise ok");
      logic_v_clear.ok = 1;
      snprintf(logic_v_clear.msg, sizeof(logic_v_clear.msg), "v clear ok");
    } else {
      snprintf(logic_bitwise.msg, sizeof(logic_bitwise.msg), "logic bitwise mismatch");
      snprintf(logic_v_clear.msg, sizeof(logic_v_clear.msg), "v clear mismatch");
    }

    uint16_t shift_prog[] = {
      encX(OPC_LOAD, 0), 0x8001,
      encR(OPC_SHR, 0, 0, 1), // 0x4000
      encR(OPC_SHL, 0, 0, 2), // 0x0000
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(shift_prog, (int)(sizeof(shift_prog) / sizeof(shift_prog[0])));
    cpu_run(200);
    int shift_ok = ((cpu_get_reg(0) & 0xFFFF) == 0x0000) &&
      cpu_get_flag_z() == 1 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 0;
    if (shift_ok) {
      logic_shifts.ok = 1;
      snprintf(logic_shifts.msg, sizeof(logic_shifts.msg), "shift semantics ok");
    } else {
      snprintf(logic_shifts.msg, sizeof(logic_shifts.msg), "shift semantics mismatch");
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
      branch_jnz_loop.ok = 1;
      snprintf(branch_jnz_loop.msg, sizeof(branch_jnz_loop.msg), "jnz loop ok");
    } else {
      snprintf(branch_jnz_loop.msg, sizeof(branch_jnz_loop.msg), "expected 55 got %d", r0);
    }

    uint16_t jn_prog[] = {
      encX(OPC_LOAD, 0), 0,
      encX(OPC_LOAD, 1), 1,
      encR(OPC_SUB, 0, 1, 0), // 0xFFFF, N=1
      encJ(OPC_JN, 18),
      encX(OPC_LOAD, 2), 111,
      encJ(OPC_JMP, 22),
      encX(OPC_LOAD, 2), 222,
      encR(OPC_HALT, 0, 0, 0)
    };
    load_program(jn_prog, (int)(sizeof(jn_prog) / sizeof(jn_prog[0])));
    cpu_run(500);
    int r2 = cpu_get_reg(2) & 0xFFFF;
    if (r2 == 222) {
      branch_jn_taken.ok = 1;
      snprintf(branch_jn_taken.msg, sizeof(branch_jn_taken.msg), "jn taken ok");
    } else {
      snprintf(branch_jn_taken.msg, sizeof(branch_jn_taken.msg), "jn mismatch r2=%d", r2);
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
    if (r1 == 17) {
      stack_push_pop.ok = 1;
      snprintf(stack_push_pop.msg, sizeof(stack_push_pop.msg), "push/pop ok");
    } else {
      snprintf(stack_push_pop.msg, sizeof(stack_push_pop.msg), "push/pop mismatch r1=%d", r1);
    }
    if (sp == 0xFFFF && r0 == 17) {
      stack_call_ret.ok = 1;
      snprintf(stack_call_ret.msg, sizeof(stack_call_ret.msg), "call/ret ok");
    } else {
      snprintf(stack_call_ret.msg, sizeof(stack_call_ret.msg), "call/ret mismatch sp=%d r0=%d", sp, r0);
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

    if (wrap == 0xABCD && r2 == 0xABCD) {
      memory_wraparound.ok = 1;
      snprintf(memory_wraparound.msg, sizeof(memory_wraparound.msg), "wraparound ok");
    } else {
      snprintf(memory_wraparound.msg, sizeof(memory_wraparound.msg), "wrap mismatch w=%d r2=%d", wrap, r2);
    }
    if (unaligned == 0x1357 && r5 == 0x1357) {
      memory_unaligned.ok = 1;
      snprintf(memory_unaligned.msg, sizeof(memory_unaligned.msg), "unaligned ok");
    } else {
      snprintf(memory_unaligned.msg, sizeof(memory_unaligned.msg), "unaligned mismatch u=%d r5=%d", unaligned, r5);
    }
  }

  {
    // End-to-end assembly suite: labels, loops, calls, memory stores.
    const char *asm_program1 =
      "LOAD R0, 3\n"
      "LOAD R1, 4\n"
      "ADD R0, R1\n"
      "SHL R0, 3\n"
      "LOAD R2, 7\n"
      "XOR R0, R2\n"
      "LOAD R3, 1000\n"
      "STR R3, R0\n"
      "LDR R4, R3\n"
      "HALT\n";
    const char *asm_program2 =
      "LOAD R0, 0\n"
      "LOAD R1, 10\n"
      "LOAD R2, 1\n"
      "LOAD R3, 0\n"
      "loop:\n"
      "ADD R0, R1\n"
      "SUB R1, R2\n"
      "CMP R1, R3\n"
      "JNZ loop\n"
      "HALT\n";
    const char *asm_program3 =
      "LOAD R0, 10\n"
      "LOAD R7, 2\n"
      "CALL sub1\n"
      "HALT\n"
      "sub1:\n"
      "LOAD R2, 5\n"
      "ADD R0, R2\n"
      "CALL sub2\n"
      "RET\n"
      "sub2:\n"
      "ADD R0, R7\n"
      "RET\n";
    const char *asm_program4 =
      "LOAD R0, 32767\n"
      "LOAD R1, 1\n"
      "ADD R0, R1\n"
      "JN neg\n"
      "LOAD R6, 111\n"
      "JMP end\n"
      "neg:\n"
      "LOAD R6, 222\n"
      "end:\n"
      "LOAD R4, 1234\n"
      "STR R4, R6\n"
      "LDR R5, R4\n"
      "HALT\n";

    uint16_t words[1024];
    char asm_err[128];
    int wc = assemble_program(asm_program1, words, 1024, asm_err, sizeof(asm_err));
    if (wc <= 0) {
      snprintf(programs_asm1.msg, sizeof(programs_asm1.msg), "asm1 fail: %s", asm_err);
    } else {
      load_program(words, wc);
      int cycles = cpu_run(2000);
      int r0 = cpu_get_reg(0) & 0xFFFF;
      int r4 = cpu_get_reg(4) & 0xFFFF;
      int m = cpu_mem_read16(1000) & 0xFFFF;
      if (!(cycles > 0 && r0 == 63 && r4 == 63 && m == 63)) {
        snprintf(programs_asm1.msg, sizeof(programs_asm1.msg), "asm1 mismatch cycles=%d r0=%d r4=%d mem=%d", cycles, r0, r4, m);
        wc = -1;
      } else {
        programs_asm1.ok = 1;
        snprintf(programs_asm1.msg, sizeof(programs_asm1.msg), "asm1 ok");
      }
    }

    if (wc > 0) {
      wc = assemble_program(asm_program2, words, 1024, asm_err, sizeof(asm_err));
      if (wc <= 0) {
        snprintf(programs_asm2.msg, sizeof(programs_asm2.msg), "asm2 fail: %s", asm_err);
      } else {
        load_program(words, wc);
        cpu_run(5000);
        int r0 = cpu_get_reg(0) & 0xFFFF;
        if (r0 != 55) {
          snprintf(programs_asm2.msg, sizeof(programs_asm2.msg), "asm2 mismatch r0=%d", r0);
          wc = -1;
        } else {
          programs_asm2.ok = 1;
          snprintf(programs_asm2.msg, sizeof(programs_asm2.msg), "asm2 ok");
        }
      }
    }

    if (wc > 0) {
      wc = assemble_program(asm_program3, words, 1024, asm_err, sizeof(asm_err));
      if (wc <= 0) {
        snprintf(programs_asm3.msg, sizeof(programs_asm3.msg), "asm3 fail: %s", asm_err);
      } else {
        load_program(words, wc);
        cpu_run(5000);
        int r0 = cpu_get_reg(0) & 0xFFFF;
        int spv = cpu_get_sp() & 0xFFFF;
        if (r0 != 17 || spv != 0xFFFF) {
          snprintf(programs_asm3.msg, sizeof(programs_asm3.msg), "asm3 mismatch r0=%d sp=%d", r0, spv);
          wc = -1;
        } else {
          programs_asm3.ok = 1;
          snprintf(programs_asm3.msg, sizeof(programs_asm3.msg), "asm3 ok");
        }
      }
    }

    if (wc > 0) {
      wc = assemble_program(asm_program4, words, 1024, asm_err, sizeof(asm_err));
      if (wc <= 0) {
        snprintf(programs_asm4.msg, sizeof(programs_asm4.msg), "asm4 fail: %s", asm_err);
      } else {
        load_program(words, wc);
        cpu_run(3000);
        int r5 = cpu_get_reg(5) & 0xFFFF;
        int memv = cpu_mem_read16(1234) & 0xFFFF;
        if (r5 != 222 || memv != 222) {
          snprintf(programs_asm4.msg, sizeof(programs_asm4.msg), "asm4 mismatch r5=%d mem=%d", r5, memv);
          wc = -1;
        } else {
          programs_asm4.ok = 1;
          snprintf(programs_asm4.msg, sizeof(programs_asm4.msg), "asm4 ok");
        }
      }
    }

    if (wc > 0) {
      const char *invalid_program =
        "LOAD R8, 1\n"
        "HALT\n";
      int bad = assemble_program(invalid_program, words, 1024, asm_err, sizeof(asm_err));
      if (bad >= 0) {
        snprintf(programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg), "invalid asm should fail but wrote %d words", bad);
        wc = -1;
      } else {
        programs_invalid_reject.ok = 1;
        snprintf(programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg), "invalid reject ok");
      }
    }

    if (wc > 0) {
      const char *bad_jump_program =
        "JMP 3000\n"
        "HALT\n";
      int bad_jump = assemble_program(bad_jump_program, words, 1024, asm_err, sizeof(asm_err));
      if (bad_jump >= 0) {
        snprintf(programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg), "out-of-range jump should fail but wrote %d words", bad_jump);
        wc = -1;
      }
    }

    if (wc > 0) {
      const char *bad_imm_program =
        "LOAD R0, 70000\n"
        "HALT\n";
      int bad_imm = assemble_program(bad_imm_program, words, 1024, asm_err, sizeof(asm_err));
      if (bad_imm >= 0) {
        snprintf(programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg), "out-of-range immediate should fail but wrote %d words", bad_imm);
        wc = -1;
      }
    }

    if (wc > 0) {
      size_t huge_len = ASM_MAX_SOURCE_BYTES + 64;
      char *huge = (char*)malloc(huge_len);
      if (!huge) {
        snprintf(programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg), "malloc failed for oversized asm");
        wc = -1;
      } else {
        for (size_t i = 0; i < huge_len - 1; i++) huge[i] = 'A';
        huge[huge_len - 1] = '\0';
        int oversized = assemble_program(huge, words, 1024, asm_err, sizeof(asm_err));
        if (oversized >= 0) {
          snprintf(programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg), "oversized asm should fail but wrote %d words", oversized);
          wc = -1;
        }
        free(huge);
      }
    }

    if (wc <= 0) {
      if (!programs_asm1.ok) snprintf(programs_asm1.msg, sizeof(programs_asm1.msg), "asm1 failed");
      if (!programs_asm2.ok) snprintf(programs_asm2.msg, sizeof(programs_asm2.msg), "asm2 failed");
      if (!programs_asm3.ok) snprintf(programs_asm3.msg, sizeof(programs_asm3.msg), "asm3 failed");
      if (!programs_asm4.ok) snprintf(programs_asm4.msg, sizeof(programs_asm4.msg), "asm4 failed");
      if (!programs_invalid_reject.ok) snprintf(programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg), "invalid reject failed");
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
      random_alu.ok = 1;
      snprintf(random_alu.msg, sizeof(random_alu.msg), "randomized ALU ok");
    } else {
      snprintf(random_alu.msg, sizeof(random_alu.msg), "randomized ALU failed %d/%d", pass, total);
    }
  }

  {
    // Benchmark: enforce both throughput and cycle-accuracy budgets.
    const int throughput_cycles = 300000;
    const double throughput_budget_s = 2.50;
    uint16_t throughput_program[] = {
      encX(OPC_LOAD, 0), 1,
      encX(OPC_LOAD, 1), 1,
      encR(OPC_ADD, 0, 1, 0),
      encJ(OPC_JMP, 8)
    };
    load_program(throughput_program, (int)(sizeof(throughput_program) / sizeof(throughput_program[0])));
    clock_t t0 = clock();
    int executed = cpu_run(throughput_cycles);
    clock_t t1 = clock();
    double throughput_elapsed = (double)(t1 - t0) / (double)CLOCKS_PER_SEC;
    int throughput_ok = (executed == throughput_cycles) && (throughput_elapsed <= throughput_budget_s);

    // Halted loop should stop exactly at HALT and report deterministic cycle count.
    const int expected_halt_cycles = 45; // 4 LOADs + 10*(ADD,SUB,CMP,JNZ) + HALT
    const double halt_budget_s = 0.75;
    uint16_t halted_program[] = {
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
    load_program(halted_program, (int)(sizeof(halted_program) / sizeof(halted_program[0])));
    clock_t t2 = clock();
    int halt_cycles = cpu_run(1000);
    clock_t t3 = clock();
    double halt_elapsed = (double)(t3 - t2) / (double)CLOCKS_PER_SEC;
    int halt_sum = cpu_get_reg(0) & 0xFFFF;
    int halt_ok = (halt_cycles == expected_halt_cycles) && (halt_sum == 55) && (halt_elapsed <= halt_budget_s);

    if (throughput_ok && halt_ok) {
      benchmark_budget.ok = 1;
      snprintf(
        benchmark_budget.msg,
        sizeof(benchmark_budget.msg),
        "benchmark ok throughput=%.3fs<=%.3fs halt=%.3fs<=%.3fs cycles=%d",
        throughput_elapsed,
        throughput_budget_s,
        halt_elapsed,
        halt_budget_s,
        halt_cycles
      );
    } else {
      snprintf(
        benchmark_budget.msg,
        sizeof(benchmark_budget.msg),
        "benchmark failed throughput cycles=%d/%d elapsed=%.3f/%.3f halt cycles=%d/%d sum=%d elapsed=%.3f/%.3f",
        executed,
        throughput_cycles,
        throughput_elapsed,
        throughput_budget_s,
        halt_cycles,
        expected_halt_cycles,
        halt_sum,
        halt_elapsed,
        halt_budget_s
      );
    }
  }

  printf("abi_reset|%d|%s\n", abi_reset.ok, abi_reset.msg);
  printf("arith_add_overflow|%d|%s\n", arith_add_overflow.ok, arith_add_overflow.msg);
  printf("arith_sub_overflow|%d|%s\n", arith_sub_overflow.ok, arith_sub_overflow.msg);
  printf("arith_cmp_flags|%d|%s\n", arith_cmp_flags.ok, arith_cmp_flags.msg);
  printf("logic_bitwise|%d|%s\n", logic_bitwise.ok, logic_bitwise.msg);
  printf("logic_shifts|%d|%s\n", logic_shifts.ok, logic_shifts.msg);
  printf("logic_v_clear|%d|%s\n", logic_v_clear.ok, logic_v_clear.msg);
  printf("branch_jnz_loop|%d|%s\n", branch_jnz_loop.ok, branch_jnz_loop.msg);
  printf("branch_jn_taken|%d|%s\n", branch_jn_taken.ok, branch_jn_taken.msg);
  printf("stack_push_pop|%d|%s\n", stack_push_pop.ok, stack_push_pop.msg);
  printf("stack_call_ret|%d|%s\n", stack_call_ret.ok, stack_call_ret.msg);
  printf("memory_wraparound|%d|%s\n", memory_wraparound.ok, memory_wraparound.msg);
  printf("memory_unaligned|%d|%s\n", memory_unaligned.ok, memory_unaligned.msg);
  printf("programs_asm1|%d|%s\n", programs_asm1.ok, programs_asm1.msg);
  printf("programs_asm2|%d|%s\n", programs_asm2.ok, programs_asm2.msg);
  printf("programs_asm3|%d|%s\n", programs_asm3.ok, programs_asm3.msg);
  printf("programs_asm4|%d|%s\n", programs_asm4.ok, programs_asm4.msg);
  printf("programs_invalid_reject|%d|%s\n", programs_invalid_reject.ok, programs_invalid_reject.msg);
  printf("random_alu|%d|%s\n", random_alu.ok, random_alu.msg);
  printf("benchmark_budget|%d|%s\n", benchmark_budget.ok, benchmark_budget.msg);
  return 0;
}
