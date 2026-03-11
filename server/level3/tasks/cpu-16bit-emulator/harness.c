#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif
void cpu_reset(void);
void cpu_load_word(int addr, int word);
int cpu_assemble(const char *src, int src_len, uint16_t *out_words,
                 int max_words) __attribute__((weak));
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
  OPC_NOP = 0x00,
  OPC_LOAD = 0x01,
  OPC_MOV = 0x02,
  OPC_ADD = 0x03,
  OPC_SUB = 0x04,
  OPC_AND = 0x05,
  OPC_OR = 0x06,
  OPC_XOR = 0x07,
  OPC_NOT = 0x08,
  OPC_SHL = 0x09,
  OPC_SHR = 0x0A,
  OPC_CMP = 0x0B,
  OPC_JMP = 0x0C,
  OPC_JZ = 0x0D,
  OPC_JNZ = 0x0E,
  OPC_JN = 0x0F,
  OPC_LDR = 0x10,
  OPC_STR = 0x11,
  OPC_PUSH = 0x12,
  OPC_POP = 0x13,
  OPC_CALL = 0x14,
  OPC_RET = 0x15,
  OPC_HALT = 0x16,
  OPC_VADD = 0x17,
  OPC_VSUB = 0x18,
  OPC_VXOR = 0x19
};

typedef struct {
  int ok;
  char msg[200];
} Check;

static uint16_t encR(int op, int dst, int src, int imm5) {
  return (uint16_t)(((op & 0x1F) << 11) | ((dst & 7) << 8) | ((src & 7) << 5) |
                    (imm5 & 0x1F));
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

enum { ASM_MAX_SOURCE_BYTES = 524288, ASM_MAX_WORDS = 131072 };

static int assemble_program(const char *src, uint16_t *out_words, int max_words,
                            char *err, size_t err_len) {
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
    snprintf(err, err_len, "cpu_assemble overflow: %d > %d", written,
             capped_words);
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

static void append_asm_line(char **ptr, size_t *remaining, const char *line) {
  size_t len = strlen(line);
  if (*remaining <= len)
    return;
  memcpy(*ptr, line, len);
  *ptr += len;
  **ptr = '\0';
  *remaining -= len;
}

static double perf_budget(double baseline, double factor, double floor_sec) {
  double scaled = baseline * factor;
  return scaled > floor_sec ? scaled : floor_sec;
}

int main(void) {
  Check abi_reset = {0, ""};
  Check arith_add_overflow = {0, ""};
  Check arith_sub_overflow = {0, ""};
  Check arith_cmp_flags = {0, ""};
  Check logic_bitwise = {0, ""};
  Check branch_jnz_loop = {0, ""};
  Check stack_push_pop = {0, ""};
  Check stack_call_ret = {0, ""};
  Check memory_wraparound = {0, ""};
  Check helper_load_word_bounds = {0, ""};
  Check simd_lane_add_wrap = {0, ""};
  Check simd_lane_sub_wrap = {0, ""};
  Check simd_lane_xor_flag_stability = {0, ""};
  Check programs_asm1 = {0, ""};
  Check programs_asm2 = {0, ""};
  Check programs_asm3 = {0, ""};
  Check programs_asm4 = {0, ""};
  Check programs_invalid_reject = {0, ""};
  Check assembler_large_labels = {0, ""};
  Check random_alu_cmp = {0, ""};
  Check benchmark_budget = {0, ""};
  Check perf_run_throughput = {0, ""};
  Check perf_simd_throughput = {0, ""};
  Check perf_asm_label_lookup = {0, ""};
  Check perf_asm_mnemonic_decode = {0, ""};

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
    uint16_t program[] = {encX(OPC_LOAD, 0),
                          0x7FFF,
                          encX(OPC_LOAD, 1),
                          1,
                          encR(OPC_ADD, 0, 1, 0),
                          encX(OPC_LOAD, 2),
                          0x8000,
                          encX(OPC_LOAD, 3),
                          1,
                          encR(OPC_SUB, 2, 3, 0),
                          encX(OPC_LOAD, 4),
                          5,
                          encX(OPC_LOAD, 5),
                          6,
                          encR(OPC_CMP, 4, 5, 0),
                          encR(OPC_HALT, 0, 0, 0)};
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(400);
    int add_ok = ((cpu_get_reg(0) & 0xFFFF) == 0x8000);
    // After CMP(5-6) => 0xFFFF, Z=0 N=1 V=0
    int cmp_ok =
        ((cpu_get_reg(4) & 0xFFFF) == 5) && ((cpu_get_reg(5) & 0xFFFF) == 6);
    int flags_ok = (cpu_get_flag_z() == 0 && cpu_get_flag_n() == 1 &&
                    cpu_get_flag_v() == 0);

    // Dedicated ADD flag check
    uint16_t add_prog[] = {encX(OPC_LOAD, 0),      0x7FFF,
                           encX(OPC_LOAD, 1),      1,
                           encR(OPC_ADD, 0, 1, 0), encR(OPC_HALT, 0, 0, 0)};
    load_program(add_prog, (int)(sizeof(add_prog) / sizeof(add_prog[0])));
    cpu_run(100);
    int add_flags_ok = (cpu_get_flag_z() == 0 && cpu_get_flag_n() == 1 &&
                        cpu_get_flag_v() == 1);

    // Dedicated SUB overflow check: 0x8000 - 1 => 0x7FFF, V=1
    uint16_t sub_prog[] = {encX(OPC_LOAD, 0),      0x8000,
                           encX(OPC_LOAD, 1),      1,
                           encR(OPC_SUB, 0, 1, 0), encR(OPC_HALT, 0, 0, 0)};
    load_program(sub_prog, (int)(sizeof(sub_prog) / sizeof(sub_prog[0])));
    cpu_run(100);
    int sub_flags_ok = ((cpu_get_reg(0) & 0xFFFF) == 0x7FFF) &&
                       (cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 &&
                        cpu_get_flag_v() == 1);

    if (add_ok && add_flags_ok) {
      arith_add_overflow.ok = 1;
      snprintf(arith_add_overflow.msg, sizeof(arith_add_overflow.msg),
               "add overflow ok");
    } else {
      snprintf(arith_add_overflow.msg, sizeof(arith_add_overflow.msg),
               "add overflow mismatch");
    }

    if (sub_flags_ok) {
      arith_sub_overflow.ok = 1;
      snprintf(arith_sub_overflow.msg, sizeof(arith_sub_overflow.msg),
               "sub overflow ok");
    } else {
      snprintf(arith_sub_overflow.msg, sizeof(arith_sub_overflow.msg),
               "sub overflow mismatch");
    }

    if (cmp_ok && flags_ok) {
      arith_cmp_flags.ok = 1;
      snprintf(arith_cmp_flags.msg, sizeof(arith_cmp_flags.msg),
               "cmp flags ok");
    } else {
      snprintf(arith_cmp_flags.msg, sizeof(arith_cmp_flags.msg),
               "cmp flags mismatch");
    }
  }

  {
    uint16_t program[] = {encX(OPC_LOAD, 0),      0x00F0,
                          encX(OPC_LOAD, 1),      0x0F00,
                          encR(OPC_AND, 0, 1, 0), // -> 0x0000 Z=1 N=0 V=0
                          encR(OPC_OR, 0, 1, 0),  // -> 0x0F00 Z=0 N=0 V=0
                          encR(OPC_XOR, 0, 1, 0), // -> 0x0000 Z=1 N=0 V=0
                          encR(OPC_NOT, 0, 0, 0), // -> 0xFFFF Z=0 N=1 V=0
                          encR(OPC_SHR, 0, 0, 1), // -> 0x7FFF Z=0 N=0 V=0
                          encR(OPC_SHL, 0, 0, 1), // -> 0xFFFE Z=0 N=1 V=0
                          encR(OPC_MOV, 2, 0, 0), // flags unaffected
                          encR(OPC_HALT, 0, 0, 0)};
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(500);
    int bitwise_ok = ((cpu_get_reg(0) & 0xFFFF) == 0xFFFE) &&
                     ((cpu_get_reg(2) & 0xFFFF) == 0xFFFE) &&
                     cpu_get_flag_z() == 0 && cpu_get_flag_n() == 1 &&
                     cpu_get_flag_v() == 0;

    uint16_t shift_prog[] = {encX(OPC_LOAD, 0), 0x8001,
                             encR(OPC_SHR, 0, 0, 1), // 0x4000
                             encR(OPC_SHL, 0, 0, 2), // 0x0000
                             encR(OPC_HALT, 0, 0, 0)};
    load_program(shift_prog, (int)(sizeof(shift_prog) / sizeof(shift_prog[0])));
    cpu_run(200);
    int shift_ok = ((cpu_get_reg(0) & 0xFFFF) == 0x0000) &&
                   cpu_get_flag_z() == 1 && cpu_get_flag_n() == 0 &&
                   cpu_get_flag_v() == 0;

    uint16_t shift_mod_prog[] = {
        encX(OPC_LOAD, 0), 0x0001,
        encR(OPC_SHL, 0, 0, 16), // imm5 16 -> shift by (16 mod 16)=0
        encR(OPC_SHR, 0, 0, 31), // imm5 31 -> shift by 15 => 0
        encR(OPC_HALT, 0, 0, 0)};
    load_program(shift_mod_prog,
                 (int)(sizeof(shift_mod_prog) / sizeof(shift_mod_prog[0])));
    cpu_run(200);
    int shift_mod_ok = ((cpu_get_reg(0) & 0xFFFF) == 0x0000) &&
                       cpu_get_flag_z() == 1 && cpu_get_flag_n() == 0 &&
                       cpu_get_flag_v() == 0;

    // Instructions that must not modify flags.
    uint16_t flags_prog[] = {encX(OPC_LOAD, 0),      0x8000,
                             encX(OPC_LOAD, 1),      1,
                             encR(OPC_SUB, 0, 1, 0), // sets N=0,V=1
                             encX(OPC_LOAD, 2),      0x1234,
                             encR(OPC_MOV, 3, 2, 0), encR(OPC_STR, 2, 3, 0),
                             encR(OPC_LDR, 4, 2, 0), encR(OPC_PUSH, 4, 0, 0),
                             encR(OPC_POP, 5, 0, 0), encR(OPC_NOP, 0, 0, 0),
                             encR(OPC_HALT, 0, 0, 0)};
    load_program(flags_prog, (int)(sizeof(flags_prog) / sizeof(flags_prog[0])));
    cpu_run(500);
    int non_effect_ok =
        cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 1;

    if (bitwise_ok && shift_ok && shift_mod_ok && non_effect_ok) {
      logic_bitwise.ok = 1;
      snprintf(logic_bitwise.msg, sizeof(logic_bitwise.msg),
               "logic+shift+flag-non-effect ok");
    } else {
      snprintf(logic_bitwise.msg, sizeof(logic_bitwise.msg),
               "logic mismatch bitwise=%d shift=%d mod=%d non_effect=%d",
               bitwise_ok, shift_ok, shift_mod_ok, non_effect_ok);
    }
  }

  {
    // Branching: sum 10..1 using JNZ and CMP
    uint16_t program[] = {encX(OPC_LOAD, 0),      0,
                          encX(OPC_LOAD, 1),      10,
                          encX(OPC_LOAD, 2),      1,
                          encX(OPC_LOAD, 3),      0,
                          encR(OPC_ADD, 0, 1, 0), encR(OPC_SUB, 1, 2, 0),
                          encR(OPC_CMP, 1, 3, 0), encJ(OPC_JNZ, 16),
                          encR(OPC_HALT, 0, 0, 0)};
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(3000);
    int r0 = cpu_get_reg(0) & 0xFFFF;
    int jnz_ok = (r0 == 55);

    uint16_t jn_prog[] = {encX(OPC_LOAD, 0),
                          0,
                          encX(OPC_LOAD, 1),
                          1,
                          encR(OPC_SUB, 0, 1, 0), // 0xFFFF, N=1
                          encJ(OPC_JN, 18),
                          encX(OPC_LOAD, 2),
                          111,
                          encJ(OPC_JMP, 22),
                          encX(OPC_LOAD, 2),
                          222,
                          encR(OPC_HALT, 0, 0, 0)};
    load_program(jn_prog, (int)(sizeof(jn_prog) / sizeof(jn_prog[0])));
    cpu_run(500);
    int r2 = cpu_get_reg(2) & 0xFFFF;
    int jn_ok = (r2 == 222);

    // Odd-PC fetch semantics via byte-address jump.
    cpu_reset();
    cpu_load_word(0, encJ(OPC_JMP, 5));
    cpu_load_word(5, encX(OPC_LOAD, 6));
    cpu_load_word(7, 0x2A2A);
    cpu_load_word(9, encR(OPC_HALT, 0, 0, 0));
    cpu_run(200);
    int odd_pc_ok = ((cpu_get_reg(6) & 0xFFFF) == 0x2A2A);

    if (jnz_ok && jn_ok && odd_pc_ok) {
      branch_jnz_loop.ok = 1;
      snprintf(branch_jnz_loop.msg, sizeof(branch_jnz_loop.msg),
               "jnz+jn+odd-pc control ok");
    } else {
      snprintf(branch_jnz_loop.msg, sizeof(branch_jnz_loop.msg),
               "branch mismatch jnz=%d(sum=%d) jn=%d(r2=%d) odd_pc=%d", jnz_ok,
               r0, jn_ok, r2, odd_pc_ok);
    }
  }

  {
    // Stack + CALL/RET + nested call discipline
    uint16_t program[] = {encX(OPC_LOAD, 0), 10, encX(OPC_LOAD, 7), 2,
                          encX(OPC_CALL, 0), 18, encR(OPC_PUSH, 0, 0, 0),
                          encR(OPC_POP, 1, 0, 0), encR(OPC_HALT, 0, 0, 0),

                          // sub1 @ 18
                          encX(OPC_LOAD, 2), 5, encR(OPC_ADD, 0, 2, 0),
                          encX(OPC_CALL, 0), 30, encR(OPC_RET, 0, 0, 0),

                          // sub2 @ 30
                          encR(OPC_ADD, 0, 7, 0), encR(OPC_RET, 0, 0, 0)};
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(4000);
    int sp = cpu_get_sp() & 0xFFFF;
    int r0 = cpu_get_reg(0) & 0xFFFF;
    int r1 = cpu_get_reg(1) & 0xFFFF;
    if (r1 == 17) {
      stack_push_pop.ok = 1;
      snprintf(stack_push_pop.msg, sizeof(stack_push_pop.msg), "push/pop ok");
    } else {
      snprintf(stack_push_pop.msg, sizeof(stack_push_pop.msg),
               "push/pop mismatch r1=%d", r1);
    }

    // CALL extension fetch across wrap boundary and return-address integrity.
    cpu_reset();
    uint16_t bootstrap[] = {
        encX(OPC_LOAD, 0),
        0xFFFE,
        encR(OPC_PUSH, 0, 0, 0),
        encR(OPC_RET, 0, 0, 0),
    };
    load_program(bootstrap, (int)(sizeof(bootstrap) / sizeof(bootstrap[0])));
    cpu_run(3);
    cpu_load_word(0, 6); // extension word read by CALL at 0xFFFE
    cpu_load_word(2, encR(OPC_HALT, 0, 0, 0)); // return site
    cpu_load_word(6, encR(OPC_RET, 0, 0, 0));  // target
    cpu_load_word(0xFFFE, encX(OPC_CALL, 0));
    cpu_run(50);
    int wrap_call_ok = (cpu_get_pc() == 4) && (cpu_get_sp() == 0xFFFF);

    if (sp == 0xFFFF && r0 == 17 && wrap_call_ok) {
      stack_call_ret.ok = 1;
      snprintf(stack_call_ret.msg, sizeof(stack_call_ret.msg),
               "call/ret+wrap ok");
    } else {
      snprintf(stack_call_ret.msg, sizeof(stack_call_ret.msg),
               "call/ret mismatch sp=%d r0=%d wrap=%d", sp, r0, wrap_call_ok);
    }
  }

  {
    // Memory: core accesses wrap modulo 2^16, but public helpers reject addr
    // 65535.
    uint16_t program[] = {encX(OPC_LOAD, 0),      0xABCD,
                          encX(OPC_LOAD, 1),      0xFFFF,
                          encR(OPC_STR, 1, 0, 0), encR(OPC_LDR, 2, 1, 0),
                          encX(OPC_LOAD, 3),      0x1357,
                          encX(OPC_LOAD, 4),      1,
                          encR(OPC_STR, 4, 3, 0), encR(OPC_LDR, 5, 4, 0),
                          encR(OPC_HALT, 0, 0, 0)};
    load_program(program, (int)(sizeof(program) / sizeof(program[0])));
    cpu_run(1000);

    int wrap = cpu_mem_read16(0xFFFF) & 0xFFFF;
    int unaligned = cpu_mem_read16(1) & 0xFFFF;
    int r2 = cpu_get_reg(2) & 0xFFFF;
    int r5 = cpu_get_reg(5) & 0xFFFF;

    if (wrap == 0 && r2 == 0xABCD && unaligned == 0x1357 && r5 == 0x1357) {
      memory_wraparound.ok = 1;
      snprintf(memory_wraparound.msg, sizeof(memory_wraparound.msg),
               "wrap+unaligned semantics ok");
    } else {
      snprintf(memory_wraparound.msg, sizeof(memory_wraparound.msg),
               "mem mismatch wrap=%d r2=%d unaligned=%d r5=%d", wrap, r2,
               unaligned, r5);
    }
  }

  {
    int load_ok = 0;
    int read_ok = 0;
    int unaligned_load_ok = 0;
    int accessor_ok = 0;
    cpu_reset();
    cpu_load_word(0, 0);
    cpu_load_word(65535, 0xABCD);
    load_ok = ((cpu_mem_read16(0) & 0xFFFF) == 0);

    cpu_set_reg(-1, 7);
    cpu_set_reg(8, 7);
    accessor_ok = (cpu_get_reg(-1) == 0) && (cpu_get_reg(8) == 0);

    cpu_reset();
    cpu_load_word(1, 0x1234);
    unaligned_load_ok = (cpu_mem_read16(1) == 0x1234);

    cpu_reset();
    cpu_load_word(65534, 0x3412);
    read_ok = (cpu_mem_read16(65535) == 0);
    if (load_ok && read_ok && unaligned_load_ok && accessor_ok) {
      helper_load_word_bounds.ok = 1;
      snprintf(helper_load_word_bounds.msg, sizeof(helper_load_word_bounds.msg),
               "helper/accessor bounds ok");
    } else {
      snprintf(
          helper_load_word_bounds.msg, sizeof(helper_load_word_bounds.msg),
          "helper bounds mismatch load=%d read=%d unaligned=%d accessor=%d",
          load_ok, read_ok, unaligned_load_ok, accessor_ok);
    }
  }

  {
    // SIMD: vectors are packed in (R0..R3) and (R4..R7). Flags must remain
    // unchanged.
    uint16_t add_prog[] = {
        encX(OPC_LOAD, 0),       0xFFFF,
        encX(OPC_LOAD, 1),       0x0001,
        encX(OPC_LOAD, 2),       0x7FFF,
        encX(OPC_LOAD, 3),       0x8000,
        encX(OPC_LOAD, 4),       0x0001,
        encX(OPC_LOAD, 5),       0x0001,
        encX(OPC_LOAD, 6),       0x0001,
        encX(OPC_LOAD, 7),       0x8000,
        encR(OPC_VADD, 0, 4, 0), encR(OPC_HALT, 0, 0, 0),
    };
    load_program(add_prog, (int)(sizeof(add_prog) / sizeof(add_prog[0])));
    cpu_run(500);
    int vadd_ok = (cpu_get_reg(0) == 0x0000) && (cpu_get_reg(1) == 0x0002) &&
                  (cpu_get_reg(2) == 0x8000) && (cpu_get_reg(3) == 0x0000);
    uint16_t vadd_flags_prog[] = {
        encX(OPC_LOAD, 6),       0x8000,
        encX(OPC_LOAD, 7),       1,
        encR(OPC_SUB, 6, 7, 0), // Z=0 N=0 V=1
        encX(OPC_LOAD, 0),       1,
        encX(OPC_LOAD, 1),       2,
        encX(OPC_LOAD, 2),       3,
        encX(OPC_LOAD, 3),       4,
        encX(OPC_LOAD, 4),       5,
        encX(OPC_LOAD, 5),       6,
        encX(OPC_LOAD, 6),       7,
        encX(OPC_LOAD, 7),       8,
        encR(OPC_VADD, 0, 4, 0), encR(OPC_HALT, 0, 0, 0),
    };
    load_program(vadd_flags_prog,
                 (int)(sizeof(vadd_flags_prog) / sizeof(vadd_flags_prog[0])));
    cpu_run(700);
    int vadd_flags_unchanged =
        cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 1;
    if (vadd_ok && vadd_flags_unchanged) {
      simd_lane_add_wrap.ok = 1;
      snprintf(simd_lane_add_wrap.msg, sizeof(simd_lane_add_wrap.msg),
               "simd vadd wrap + flag stability ok");
    } else {
      snprintf(simd_lane_add_wrap.msg, sizeof(simd_lane_add_wrap.msg),
               "simd vadd mismatch vec=%d flags=%d", vadd_ok,
               vadd_flags_unchanged);
    }

    uint16_t sub_prog[] = {
        encX(OPC_LOAD, 0),       0x0000,
        encX(OPC_LOAD, 1),       0x0003,
        encX(OPC_LOAD, 2),       0x8000,
        encX(OPC_LOAD, 3),       0x0000,
        encX(OPC_LOAD, 4),       0x0001,
        encX(OPC_LOAD, 5),       0x0005,
        encX(OPC_LOAD, 6),       0x0001,
        encX(OPC_LOAD, 7),       0xFFFF,
        encR(OPC_VSUB, 0, 4, 0), encR(OPC_HALT, 0, 0, 0),
    };
    load_program(sub_prog, (int)(sizeof(sub_prog) / sizeof(sub_prog[0])));
    cpu_run(500);
    int vsub_ok = (cpu_get_reg(0) == 0xFFFF) && (cpu_get_reg(1) == 0xFFFE) &&
                  (cpu_get_reg(2) == 0x7FFF) && (cpu_get_reg(3) == 0x0001);
    uint16_t vsub_flags_prog[] = {
        encX(OPC_LOAD, 6),       0x8000,
        encX(OPC_LOAD, 7),       1,
        encR(OPC_SUB, 6, 7, 0), // Z=0 N=0 V=1
        encX(OPC_LOAD, 0),       9,
        encX(OPC_LOAD, 1),       8,
        encX(OPC_LOAD, 2),       7,
        encX(OPC_LOAD, 3),       6,
        encX(OPC_LOAD, 4),       1,
        encX(OPC_LOAD, 5),       2,
        encX(OPC_LOAD, 6),       3,
        encX(OPC_LOAD, 7),       4,
        encR(OPC_VSUB, 0, 4, 0), encR(OPC_HALT, 0, 0, 0),
    };
    load_program(vsub_flags_prog,
                 (int)(sizeof(vsub_flags_prog) / sizeof(vsub_flags_prog[0])));
    cpu_run(700);
    int vsub_flags_unchanged =
        cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 1;
    if (vsub_ok && vsub_flags_unchanged) {
      simd_lane_sub_wrap.ok = 1;
      snprintf(simd_lane_sub_wrap.msg, sizeof(simd_lane_sub_wrap.msg),
               "simd vsub wrap + flag stability ok");
    } else {
      snprintf(simd_lane_sub_wrap.msg, sizeof(simd_lane_sub_wrap.msg),
               "simd vsub mismatch vec=%d flags=%d", vsub_ok,
               vsub_flags_unchanged);
    }

    uint16_t xor_prog[] = {
        encX(OPC_LOAD, 6),       1,
        encX(OPC_LOAD, 7),       1,
        encR(OPC_ADD, 6, 7, 0), // sets Z=0 N=0 V=0
        encX(OPC_LOAD, 0),       0x00FF,
        encX(OPC_LOAD, 1),       0x0F0F,
        encX(OPC_LOAD, 2),       0xAAAA,
        encX(OPC_LOAD, 3),       0x5555,
        encX(OPC_LOAD, 4),       0x0F0F,
        encX(OPC_LOAD, 5),       0xFFFF,
        encX(OPC_LOAD, 6),       0x00FF,
        encX(OPC_LOAD, 7),       0x5555,
        encR(OPC_VXOR, 0, 4, 0), encR(OPC_HALT, 0, 0, 0),
    };
    load_program(xor_prog, (int)(sizeof(xor_prog) / sizeof(xor_prog[0])));
    cpu_run(800);
    int vxor_ok = (cpu_get_reg(0) == 0x0FF0) && (cpu_get_reg(1) == 0xF0F0) &&
                  (cpu_get_reg(2) == 0xAA55) && (cpu_get_reg(3) == 0x0000);
    int flags_unchanged =
        cpu_get_flag_z() == 0 && cpu_get_flag_n() == 0 && cpu_get_flag_v() == 0;
    cpu_reset();
    cpu_load_word(0, encR(OPC_VADD, 1, 4, 0)); // invalid SIMD base (dst=R1)
    cpu_load_word(2, encX(OPC_LOAD, 0)); // must not execute if invalid halts
    cpu_load_word(4, 0x7777);
    int invalid_cycles = cpu_run(10);
    int invalid_halt_ok =
        (invalid_cycles == 1) && ((cpu_get_reg(0) & 0xFFFF) == 0);

    if (vxor_ok && flags_unchanged && invalid_halt_ok) {
      simd_lane_xor_flag_stability.ok = 1;
      snprintf(simd_lane_xor_flag_stability.msg,
               sizeof(simd_lane_xor_flag_stability.msg),
               "simd vxor flags stable + invalid-encoding halt");
    } else {
      snprintf(simd_lane_xor_flag_stability.msg,
               sizeof(simd_lane_xor_flag_stability.msg),
               "simd vxor mismatch vec=%d flags=%d invalid_halt=%d(cycles=%d)",
               vxor_ok, flags_unchanged, invalid_halt_ok, invalid_cycles);
    }
  }

  {
    // End-to-end assembly suite: labels, loops, calls, memory stores.
    const char *asm_program1 = "LOAD R0, 3\n"
                               "LOAD R1, 4\n"
                               "ADD R0, R1\n"
                               "SHL R0, 3\n"
                               "LOAD R2, 7\n"
                               "XOR R0, R2\n"
                               "LOAD R3, 1000\n"
                               "STR R3, R0\n"
                               "LDR R4, R3\n"
                               "HALT\n";
    const char *asm_program2 = "LOAD R0, 0\n"
                               "LOAD R1, 10\n"
                               "LOAD R2, 1\n"
                               "LOAD R3, 0\n"
                               "loop:\n"
                               "ADD R0, R1\n"
                               "SUB R1, R2\n"
                               "CMP R1, R3\n"
                               "JNZ loop\n"
                               "HALT\n";
    const char *asm_program3 = "LOAD R0, 10\n"
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
    const char *asm_program4 = "LOAD R0, 32767\n"
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
    int wc =
        assemble_program(asm_program1, words, 1024, asm_err, sizeof(asm_err));
    if (wc <= 0) {
      snprintf(programs_asm1.msg, sizeof(programs_asm1.msg), "asm1 fail: %s",
               asm_err);
    } else {
      load_program(words, wc);
      int cycles = cpu_run(2000);
      int r0 = cpu_get_reg(0) & 0xFFFF;
      int r4 = cpu_get_reg(4) & 0xFFFF;
      int m = cpu_mem_read16(1000) & 0xFFFF;
      if (!(cycles > 0 && r0 == 63 && r4 == 63 && m == 63)) {
        snprintf(programs_asm1.msg, sizeof(programs_asm1.msg),
                 "asm1 mismatch cycles=%d r0=%d r4=%d mem=%d", cycles, r0, r4,
                 m);
        wc = -1;
      } else {
        programs_asm1.ok = 1;
        snprintf(programs_asm1.msg, sizeof(programs_asm1.msg), "asm1 ok");
      }
    }

    if (wc > 0) {
      wc =
          assemble_program(asm_program2, words, 1024, asm_err, sizeof(asm_err));
      if (wc <= 0) {
        snprintf(programs_asm2.msg, sizeof(programs_asm2.msg), "asm2 fail: %s",
                 asm_err);
      } else {
        load_program(words, wc);
        cpu_run(5000);
        int r0 = cpu_get_reg(0) & 0xFFFF;
        if (r0 != 55) {
          snprintf(programs_asm2.msg, sizeof(programs_asm2.msg),
                   "asm2 mismatch r0=%d", r0);
          wc = -1;
        } else {
          programs_asm2.ok = 1;
          snprintf(programs_asm2.msg, sizeof(programs_asm2.msg), "asm2 ok");
        }
      }
    }

    if (wc > 0) {
      wc =
          assemble_program(asm_program3, words, 1024, asm_err, sizeof(asm_err));
      if (wc <= 0) {
        snprintf(programs_asm3.msg, sizeof(programs_asm3.msg), "asm3 fail: %s",
                 asm_err);
      } else {
        load_program(words, wc);
        cpu_run(5000);
        int r0 = cpu_get_reg(0) & 0xFFFF;
        int spv = cpu_get_sp() & 0xFFFF;
        if (r0 != 17 || spv != 0xFFFF) {
          snprintf(programs_asm3.msg, sizeof(programs_asm3.msg),
                   "asm3 mismatch r0=%d sp=%d", r0, spv);
          wc = -1;
        } else {
          programs_asm3.ok = 1;
          snprintf(programs_asm3.msg, sizeof(programs_asm3.msg), "asm3 ok");
        }
      }
    }

    if (wc > 0) {
      wc =
          assemble_program(asm_program4, words, 1024, asm_err, sizeof(asm_err));
      if (wc <= 0) {
        snprintf(programs_asm4.msg, sizeof(programs_asm4.msg), "asm4 fail: %s",
                 asm_err);
      } else {
        load_program(words, wc);
        cpu_run(3000);
        int r5 = cpu_get_reg(5) & 0xFFFF;
        int memv = cpu_mem_read16(1234) & 0xFFFF;
        if (r5 != 222 || memv != 222) {
          snprintf(programs_asm4.msg, sizeof(programs_asm4.msg),
                   "asm4 mismatch r5=%d mem=%d", r5, memv);
          wc = -1;
        } else {
          programs_asm4.ok = 1;
          snprintf(programs_asm4.msg, sizeof(programs_asm4.msg), "asm4 ok");
        }
      }
    }

    {
      int reject_failures = 0;
      char reject_details[200] = "";
#define APPEND_REJECT_DETAIL(token)                                            \
  do {                                                                         \
    size_t detail_len = strlen(reject_details);                                \
    size_t token_len = strlen(token);                                          \
    if (detail_len + token_len + 1 < sizeof(reject_details)) {                 \
      memcpy(reject_details + detail_len, token, token_len);                   \
      reject_details[detail_len + token_len] = '\0';                           \
    }                                                                          \
  } while (0)

      const char *invalid_program = "LOAD R8, 1\n"
                                    "HALT\n";
      int bad = assemble_program(invalid_program, words, 1024, asm_err,
                                 sizeof(asm_err));
      if (bad >= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("invalid_reg ");
      }

      const char *bad_jump_program = "JMP 3000\n"
                                     "HALT\n";
      int bad_jump = assemble_program(bad_jump_program, words, 1024, asm_err,
                                      sizeof(asm_err));
      if (bad_jump >= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("jump_range ");
      }

      const char *bad_imm_program = "LOAD R0, 70000\n"
                                    "HALT\n";
      int bad_imm = assemble_program(bad_imm_program, words, 1024, asm_err,
                                     sizeof(asm_err));
      if (bad_imm >= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("imm_range ");
      }

      const char *bad_neg_imm_program = "LOAD R0, -32769\n"
                                        "HALT\n";
      int bad_neg_imm = assemble_program(bad_neg_imm_program, words, 1024,
                                         asm_err, sizeof(asm_err));
      if (bad_neg_imm >= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("neg_imm ");
      }

      const char *bad_neg_jump_program = "JMP -1\n"
                                         "HALT\n";
      int bad_neg_jump = assemble_program(bad_neg_jump_program, words, 1024,
                                          asm_err, sizeof(asm_err));
      if (bad_neg_jump >= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("neg_jump ");
      }

      const char *undef_label_program = "JMP missing_label\n"
                                        "HALT\n";
      int undef_label = assemble_program(undef_label_program, words, 1024,
                                         asm_err, sizeof(asm_err));
      if (undef_label >= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("undef_label ");
      }

      const char *dup_label_program = "loop: NOP\n"
                                      "loop: HALT\n";
      int dup_label = assemble_program(dup_label_program, words, 1024, asm_err,
                                       sizeof(asm_err));
      if (dup_label >= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("dup_label ");
      }

      // Max-word bound: require negative error and no write beyond max_words.
      struct {
        uint16_t out[2];
        uint16_t guard;
      } bounded = {{0, 0}, 0xBEEF};
      const char *too_long_program = "LOAD R0, 1\n"
                                     "LOAD R1, 2\n"
                                     "ADD R0, R1\n"
                                     "HALT\n";
      int short_buf = assemble_program(too_long_program, bounded.out, 2,
                                       asm_err, sizeof(asm_err));
      if (short_buf >= 0 || bounded.guard != 0xBEEF) {
        reject_failures++;
        APPEND_REJECT_DETAIL("max_words ");
      }

      // Positive syntax coverage: # immediates and negative immediates
      // in-range.
      const char *syntax_ok_program = "; full-line comment\n"
                                      "LOAD R0, #5 ; inline comment\n"
                                      "LOAD R1, -1\n"
                                      "LOAD R2, -32768\n"
                                      "HALT\n";
      int syntax_ok = assemble_program(syntax_ok_program, words, 1024, asm_err,
                                       sizeof(asm_err));
      if (syntax_ok <= 0) {
        reject_failures++;
        APPEND_REJECT_DETAIL("syntax_pos ");
      }

      size_t huge_len = ASM_MAX_SOURCE_BYTES + 64;
      char *huge = (char *)malloc(huge_len);
      if (!huge) {
        reject_failures++;
        APPEND_REJECT_DETAIL("oversized_alloc ");
      } else {
        for (size_t i = 0; i < huge_len - 1; i++)
          huge[i] = 'A';
        huge[huge_len - 1] = '\0';
        int oversized =
            assemble_program(huge, words, 1024, asm_err, sizeof(asm_err));
        if (oversized >= 0) {
          reject_failures++;
          APPEND_REJECT_DETAIL("oversized_accept ");
        }
        free(huge);
      }

      if (reject_failures == 0) {
        programs_invalid_reject.ok = 1;
        snprintf(programs_invalid_reject.msg,
                 sizeof(programs_invalid_reject.msg),
                 "invalid reject suite ok");
      } else {
        snprintf(
            programs_invalid_reject.msg, sizeof(programs_invalid_reject.msg),
            "invalid reject failed (%d): %s", reject_failures, reject_details);
        wc = -1;
      }
#undef APPEND_REJECT_DETAIL
    }

    if (wc <= 0) {
      if (!programs_asm1.ok)
        snprintf(programs_asm1.msg, sizeof(programs_asm1.msg), "asm1 failed");
      if (!programs_asm2.ok)
        snprintf(programs_asm2.msg, sizeof(programs_asm2.msg), "asm2 failed");
      if (!programs_asm3.ok)
        snprintf(programs_asm3.msg, sizeof(programs_asm3.msg), "asm3 failed");
      if (!programs_asm4.ok)
        snprintf(programs_asm4.msg, sizeof(programs_asm4.msg), "asm4 failed");
      if (!programs_invalid_reject.ok)
        snprintf(programs_invalid_reject.msg,
                 sizeof(programs_invalid_reject.msg), "invalid reject failed");
    }
  }

  {
    // Randomized ALU + CMP property checks for result + Z/N/V formulas.
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

      uint16_t add_prog[] = {encX(OPC_LOAD, 0),      a,
                             encX(OPC_LOAD, 1),      b,
                             encR(OPC_ADD, 0, 1, 0), encR(OPC_HALT, 0, 0, 0)};
      load_program(add_prog, (int)(sizeof(add_prog) / sizeof(add_prog[0])));
      cpu_run(200);
      int gotAdd = cpu_get_reg(0) & 0xFFFF;
      int gotZ = cpu_get_flag_z() ? 1 : 0;
      int gotN = cpu_get_flag_n() ? 1 : 0;
      int gotV = cpu_get_flag_v() ? 1 : 0;
      if (!(gotAdd == add_expected && gotZ == addZ && gotN == addN &&
            gotV == addV))
        continue;

      uint16_t sub_expected = (uint16_t)(a - b);
      int subZ = sub_expected == 0 ? 1 : 0;
      int subN = (sub_expected & 0x8000u) ? 1 : 0;
      int subV = sub_overflow(a, b, sub_expected);

      uint16_t sub_prog[] = {encX(OPC_LOAD, 0),      a,
                             encX(OPC_LOAD, 1),      b,
                             encR(OPC_SUB, 0, 1, 0), encR(OPC_HALT, 0, 0, 0)};
      load_program(sub_prog, (int)(sizeof(sub_prog) / sizeof(sub_prog[0])));
      cpu_run(200);
      int gotSub = cpu_get_reg(0) & 0xFFFF;
      gotZ = cpu_get_flag_z() ? 1 : 0;
      gotN = cpu_get_flag_n() ? 1 : 0;
      gotV = cpu_get_flag_v() ? 1 : 0;
      if (!(gotSub == sub_expected && gotZ == subZ && gotN == subN &&
            gotV == subV))
        continue;

      uint16_t cmp_prog[] = {encX(OPC_LOAD, 0),      a,
                             encX(OPC_LOAD, 1),      b,
                             encR(OPC_CMP, 0, 1, 0), encR(OPC_HALT, 0, 0, 0)};
      load_program(cmp_prog, (int)(sizeof(cmp_prog) / sizeof(cmp_prog[0])));
      cpu_run(200);
      gotZ = cpu_get_flag_z() ? 1 : 0;
      gotN = cpu_get_flag_n() ? 1 : 0;
      gotV = cpu_get_flag_v() ? 1 : 0;
      if (gotZ == subZ && gotN == subN && gotV == subV)
        pass++;
    }
    if (pass == total) {
      random_alu_cmp.ok = 1;
      snprintf(random_alu_cmp.msg, sizeof(random_alu_cmp.msg),
               "randomized ALU+CMP ok");
    } else {
      snprintf(random_alu_cmp.msg, sizeof(random_alu_cmp.msg),
               "randomized ALU+CMP failed %d/%d", pass, total);
    }
  }

  {
    const int labels = 20000;
    const int max_words = labels + 1;
    size_t cap = (size_t)labels * 20u + 64u;
    char *src = (char *)malloc(cap);
    uint16_t *out = (uint16_t *)malloc((size_t)max_words * sizeof(uint16_t));
    char *p = src;
    size_t remaining = cap;
    if (!src || !out) {
      snprintf(assembler_large_labels.msg, sizeof(assembler_large_labels.msg),
               "allocation failed");
    } else {
      src[0] = '\0';
      for (int i = 0; i < labels; ++i) {
        char buf[32];
        snprintf(buf, sizeof(buf), "L%d: nop\n", i);
        append_asm_line(&p, &remaining, buf);
      }
      append_asm_line(&p, &remaining, "halt\n");
      if (remaining == 0) {
        snprintf(assembler_large_labels.msg, sizeof(assembler_large_labels.msg),
                 "assembly buffer exhausted");
      } else {
        char err[160] = {0};
        int written = assemble_program(src, out, max_words, err, sizeof(err));
        if (written == max_words) {
          assembler_large_labels.ok = 1;
          snprintf(assembler_large_labels.msg,
                   sizeof(assembler_large_labels.msg), "large label set ok");
        } else {
          snprintf(assembler_large_labels.msg,
                   sizeof(assembler_large_labels.msg),
                   "large label set mismatch written=%d err=%s", written, err);
        }
      }
    }
    free(out);
    free(src);
  }

  {
    // Benchmark: enforce both throughput and cycle-accuracy budgets.
    double run_baseline_s;
    double asm_baseline_s;

    cpu_reset();
    cpu_load_word(0, encR(OPC_ADD, 0, 1, 0));
    cpu_load_word(2, encJ(OPC_JMP, 0));
    int zero_cycles = cpu_run(0);
    int neg_cycles = cpu_run(-5);
    clock_t tb0 = clock();
    int baseline_cycles = cpu_run(1000000);
    clock_t tb1 = clock();
    run_baseline_s = (double)(tb1 - tb0) / (double)CLOCKS_PER_SEC;

    {
      static const char *baseline_src = "start: load r0, 1\n"
                                        "load r1, 2\n"
                                        "add r0, r1\n"
                                        "cmp r0, r1\n"
                                        "jnz start\n"
                                        "halt\n";
      uint16_t out[16];
      int baseline_words = 0;
      clock_t ab0 = clock();
      for (int i = 0; i < 4000; ++i) {
        char err[160] = {0};
        baseline_words =
            assemble_program(baseline_src, out, 16, err, sizeof(err));
      }
      clock_t ab1 = clock();
      asm_baseline_s = (double)(ab1 - ab0) / (double)CLOCKS_PER_SEC;
      if (baseline_words != 8)
        asm_baseline_s = 0.120;
    }
    const int throughput_cycles = 300000;
    const double throughput_budget_s = 2.50;
    uint16_t throughput_program[] = {encX(OPC_LOAD, 0),      1,
                                     encX(OPC_LOAD, 1),      1,
                                     encR(OPC_ADD, 0, 1, 0), encJ(OPC_JMP, 8)};
    load_program(throughput_program, (int)(sizeof(throughput_program) /
                                           sizeof(throughput_program[0])));
    clock_t t0 = clock();
    int executed = cpu_run(throughput_cycles);
    clock_t t1 = clock();
    double throughput_elapsed = (double)(t1 - t0) / (double)CLOCKS_PER_SEC;
    int throughput_ok = (executed == throughput_cycles) &&
                        (throughput_elapsed <= throughput_budget_s);

    // Halted loop should stop exactly at HALT and report deterministic cycle
    // count.
    const int expected_halt_cycles =
        45; // 4 LOADs + 10*(ADD,SUB,CMP,JNZ) + HALT
    const double halt_budget_s = 0.75;
    uint16_t halted_program[] = {encX(OPC_LOAD, 0),      0,
                                 encX(OPC_LOAD, 1),      10,
                                 encX(OPC_LOAD, 2),      1,
                                 encX(OPC_LOAD, 3),      0,
                                 encR(OPC_ADD, 0, 1, 0), encR(OPC_SUB, 1, 2, 0),
                                 encR(OPC_CMP, 1, 3, 0), encJ(OPC_JNZ, 16),
                                 encR(OPC_HALT, 0, 0, 0)};
    load_program(halted_program,
                 (int)(sizeof(halted_program) / sizeof(halted_program[0])));
    clock_t t2 = clock();
    int halt_cycles = cpu_run(1000);
    clock_t t3 = clock();
    double halt_elapsed = (double)(t3 - t2) / (double)CLOCKS_PER_SEC;
    int halt_sum = cpu_get_reg(0) & 0xFFFF;
    int halt_ok = (halt_cycles == expected_halt_cycles) && (halt_sum == 55) &&
                  (halt_elapsed <= halt_budget_s);
    int halted_pc = cpu_get_pc() & 0xFFFF;
    int halted_sp = cpu_get_sp() & 0xFFFF;
    int halted_r0 = cpu_get_reg(0) & 0xFFFF;
    int post_halt_cycles = cpu_run(100);
    int post_halt_ok = (post_halt_cycles == 0) &&
                       ((cpu_get_pc() & 0xFFFF) == halted_pc) &&
                       ((cpu_get_sp() & 0xFFFF) == halted_sp) &&
                       ((cpu_get_reg(0) & 0xFFFF) == halted_r0);

    if (throughput_ok && halt_ok && post_halt_ok && zero_cycles == 0 &&
        neg_cycles == 0) {
      benchmark_budget.ok = 1;
      snprintf(benchmark_budget.msg, sizeof(benchmark_budget.msg),
               "benchmark ok throughput=%.3fs<=%.3fs halt=%.3fs<=%.3fs "
               "cycles=%d post_halt=%d",
               throughput_elapsed, throughput_budget_s, halt_elapsed,
               halt_budget_s, halt_cycles, post_halt_cycles);
    } else {
      snprintf(
          benchmark_budget.msg, sizeof(benchmark_budget.msg),
          "benchmark failed throughput cycles=%d/%d elapsed=%.3f/%.3f halt "
          "cycles=%d/%d sum=%d elapsed=%.3f/%.3f zero=%d neg=%d post=%d",
          executed, throughput_cycles, throughput_elapsed, throughput_budget_s,
          halt_cycles, expected_halt_cycles, halt_sum, halt_elapsed,
          halt_budget_s, zero_cycles, neg_cycles, post_halt_cycles);
    }

    {
      const double allowed = perf_budget(run_baseline_s, 15.0, 0.150);
      uint16_t program[] = {encR(OPC_ADD, 0, 1, 0), encJ(OPC_JMP, 0)};
      load_program(program, (int)(sizeof(program) / sizeof(program[0])));
      clock_t t0 = clock();
      int executed2 = cpu_run(10000000);
      clock_t t1b = clock();
      double elapsed = (double)(t1b - t0) / (double)CLOCKS_PER_SEC;
      if (baseline_cycles == 1000000 && executed2 == 10000000 &&
          elapsed < allowed) {
        perf_run_throughput.ok = 1;
        snprintf(perf_run_throughput.msg, sizeof(perf_run_throughput.msg),
                 "run throughput ok %.3f<=%.3f", elapsed, allowed);
      } else {
        snprintf(perf_run_throughput.msg, sizeof(perf_run_throughput.msg),
                 "run throughput mismatch exec=%d elapsed=%.3f<=%.3f",
                 executed2, elapsed, allowed);
      }
    }

    {
      const double allowed = perf_budget(run_baseline_s, 30.0, 0.200);
      uint16_t program[] = {encX(OPC_LOAD, 0),       1,
                            encX(OPC_LOAD, 1),       2,
                            encX(OPC_LOAD, 2),       3,
                            encX(OPC_LOAD, 3),       4,
                            encX(OPC_LOAD, 4),       5,
                            encX(OPC_LOAD, 5),       6,
                            encX(OPC_LOAD, 6),       7,
                            encX(OPC_LOAD, 7),       8,
                            encR(OPC_VADD, 0, 4, 0), encR(OPC_VSUB, 4, 0, 0),
                            encR(OPC_VXOR, 0, 4, 0), encJ(OPC_JMP, 16)};
      load_program(program, (int)(sizeof(program) / sizeof(program[0])));
      clock_t t0 = clock();
      int executed2 = cpu_run(6000000);
      clock_t t1b = clock();
      double elapsed = (double)(t1b - t0) / (double)CLOCKS_PER_SEC;
      if (executed2 == 6000000 && elapsed < allowed) {
        perf_simd_throughput.ok = 1;
        snprintf(perf_simd_throughput.msg, sizeof(perf_simd_throughput.msg),
                 "simd throughput ok %.3f<=%.3f", elapsed, allowed);
      } else {
        snprintf(perf_simd_throughput.msg, sizeof(perf_simd_throughput.msg),
                 "simd throughput mismatch exec=%d elapsed=%.3f<=%.3f",
                 executed2, elapsed, allowed);
      }
    }

    {
      const int labels = 10000;
      const int max_words = labels * 3 + 1;
      const double allowed = perf_budget(asm_baseline_s, 60.0, 0.120);
      size_t cap = (size_t)labels * 56u + 64u;
      char *src = (char *)malloc(cap);
      uint16_t *out = (uint16_t *)malloc((size_t)max_words * sizeof(uint16_t));
      char *p = src;
      size_t remaining = cap;
      if (!src || !out) {
        snprintf(perf_asm_label_lookup.msg, sizeof(perf_asm_label_lookup.msg),
                 "allocation failed");
      } else {
        src[0] = '\0';
        for (int i = 0; i < labels; ++i) {
          char buf[64];
          snprintf(buf, sizeof(buf), "load r0, L%d\n", i + 1);
          append_asm_line(&p, &remaining, buf);
          snprintf(buf, sizeof(buf), "L%d: nop\n", i);
          append_asm_line(&p, &remaining, buf);
        }
        append_asm_line(&p, &remaining, "L10000: halt\n");
        if (remaining == 0) {
          snprintf(perf_asm_label_lookup.msg, sizeof(perf_asm_label_lookup.msg),
                   "buffer exhausted");
        } else {
          char err[160] = {0};
          clock_t t0 = clock();
          int written = assemble_program(src, out, max_words, err, sizeof(err));
          clock_t t1b = clock();
          double elapsed = (double)(t1b - t0) / (double)CLOCKS_PER_SEC;
          if (written == max_words && elapsed < allowed) {
            perf_asm_label_lookup.ok = 1;
            snprintf(perf_asm_label_lookup.msg,
                     sizeof(perf_asm_label_lookup.msg),
                     "label lookup ok %.3f<=%.3f", elapsed, allowed);
          } else {
            snprintf(
                perf_asm_label_lookup.msg, sizeof(perf_asm_label_lookup.msg),
                "label lookup mismatch written=%d elapsed=%.3f<=%.3f err=%s",
                written, elapsed, allowed, err);
          }
        }
      }
      free(out);
      free(src);
    }

    {
      const int blocks = 1700;
      const int repeats = 80;
      const int lines = blocks * 19;
      const int max_words = lines + 1;
      const double allowed = perf_budget(asm_baseline_s, 100.0, 0.120);
      size_t cap = (size_t)lines * 24u + 64u;
      char *src = (char *)malloc(cap);
      uint16_t *out = (uint16_t *)malloc((size_t)max_words * sizeof(uint16_t));
      char *p = src;
      size_t remaining = cap;
      static const char *ops[] = {
          "mov r0, r1\n", "add r0, r1\n", "sub r0, r1\n", "and r0, r1\n",
          "or r0, r1\n",  "xor r0, r1\n", "cmp r0, r1\n", "ldr r0, r1\n",
          "str r0, r1\n", "not r0\n",     "push r0\n",    "pop r0\n",
          "shl r0, 15\n", "shr r0, 15\n", "nop\n",        "jz 0\n",
          "jnz 0\n",      "jn 0\n",       "ret\n"};
      if (!src || !out) {
        snprintf(perf_asm_mnemonic_decode.msg,
                 sizeof(perf_asm_mnemonic_decode.msg), "allocation failed");
      } else {
        src[0] = '\0';
        for (int i = 0; i < blocks; ++i) {
          for (int j = 0; j < (int)(sizeof(ops) / sizeof(ops[0])); ++j) {
            append_asm_line(&p, &remaining, ops[j]);
          }
        }
        append_asm_line(&p, &remaining, "halt\n");
        if (remaining == 0) {
          snprintf(perf_asm_mnemonic_decode.msg,
                   sizeof(perf_asm_mnemonic_decode.msg), "buffer exhausted");
        } else {
          int written = 0;
          clock_t t0 = clock();
          for (int i = 0; i < repeats; ++i) {
            char err[160] = {0};
            written = assemble_program(src, out, max_words, err, sizeof(err));
          }
          clock_t t1b = clock();
          double elapsed = (double)(t1b - t0) / (double)CLOCKS_PER_SEC;
          if (written == max_words && elapsed < allowed) {
            perf_asm_mnemonic_decode.ok = 1;
            snprintf(perf_asm_mnemonic_decode.msg,
                     sizeof(perf_asm_mnemonic_decode.msg),
                     "mnemonic decode ok %.3f<=%.3f", elapsed, allowed);
          } else {
            snprintf(perf_asm_mnemonic_decode.msg,
                     sizeof(perf_asm_mnemonic_decode.msg),
                     "mnemonic decode mismatch written=%d elapsed=%.3f<=%.3f",
                     written, elapsed, allowed);
          }
        }
      }
      free(out);
      free(src);
    }
  }

  printf("abi_reset|%d|%s\n", abi_reset.ok, abi_reset.msg);
  printf("arith_add_overflow|%d|%s\n", arith_add_overflow.ok,
         arith_add_overflow.msg);
  printf("arith_sub_overflow|%d|%s\n", arith_sub_overflow.ok,
         arith_sub_overflow.msg);
  printf("arith_cmp_flags|%d|%s\n", arith_cmp_flags.ok, arith_cmp_flags.msg);
  printf("logic_bitwise|%d|%s\n", logic_bitwise.ok, logic_bitwise.msg);
  printf("branch_jnz_loop|%d|%s\n", branch_jnz_loop.ok, branch_jnz_loop.msg);
  printf("stack_push_pop|%d|%s\n", stack_push_pop.ok, stack_push_pop.msg);
  printf("stack_call_ret|%d|%s\n", stack_call_ret.ok, stack_call_ret.msg);
  printf("memory_wraparound|%d|%s\n", memory_wraparound.ok,
         memory_wraparound.msg);
  printf("helper_load_word_bounds|%d|%s\n", helper_load_word_bounds.ok,
         helper_load_word_bounds.msg);
  printf("simd_lane_add_wrap|%d|%s\n", simd_lane_add_wrap.ok,
         simd_lane_add_wrap.msg);
  printf("simd_lane_sub_wrap|%d|%s\n", simd_lane_sub_wrap.ok,
         simd_lane_sub_wrap.msg);
  printf("simd_lane_xor_flag_stability|%d|%s\n",
         simd_lane_xor_flag_stability.ok, simd_lane_xor_flag_stability.msg);
  printf("programs_asm1|%d|%s\n", programs_asm1.ok, programs_asm1.msg);
  printf("programs_asm2|%d|%s\n", programs_asm2.ok, programs_asm2.msg);
  printf("programs_asm3|%d|%s\n", programs_asm3.ok, programs_asm3.msg);
  printf("programs_asm4|%d|%s\n", programs_asm4.ok, programs_asm4.msg);
  printf("programs_invalid_reject|%d|%s\n", programs_invalid_reject.ok,
         programs_invalid_reject.msg);
  printf("assembler_large_labels|%d|%s\n", assembler_large_labels.ok,
         assembler_large_labels.msg);
  printf("random_alu_cmp|%d|%s\n", random_alu_cmp.ok, random_alu_cmp.msg);
  printf("benchmark_budget|%d|%s\n", benchmark_budget.ok, benchmark_budget.msg);
  printf("perf_run_throughput|%d|%s\n", perf_run_throughput.ok,
         perf_run_throughput.msg);
  printf("perf_simd_throughput|%d|%s\n", perf_simd_throughput.ok,
         perf_simd_throughput.msg);
  printf("perf_asm_label_lookup|%d|%s\n", perf_asm_label_lookup.ok,
         perf_asm_label_lookup.msg);
  printf("perf_asm_mnemonic_decode|%d|%s\n", perf_asm_mnemonic_decode.ok,
         perf_asm_mnemonic_decode.msg);
  return 0;
}
