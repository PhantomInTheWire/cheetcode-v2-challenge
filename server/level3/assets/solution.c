#include <ctype.h>
#include <stdlib.h>
#include <string.h>

static unsigned short regs[8];
static unsigned short pc = 0;
static unsigned short sp = 0xFFFF;
static unsigned char mem[65536];
static int flag_z = 0;
static int flag_n = 0;
static int flag_v = 0;
static int halted = 0;

static unsigned short read16(unsigned short addr) {
  unsigned short lo = (unsigned short)mem[addr];
  unsigned short hi = (unsigned short)mem[(unsigned short)(addr + 1)];
  return (unsigned short)((hi << 8) | lo);
}

static void write16(unsigned short addr, unsigned short value) {
  mem[addr] = (unsigned char)(value & 0xFF);
  mem[(unsigned short)(addr + 1)] = (unsigned char)((value >> 8) & 0xFF);
}

static void set_zn(unsigned short value) {
  flag_z = (value == 0) ? 1 : 0;
  flag_n = (value & 0x8000) ? 1 : 0;
}

static void set_add_flags(unsigned short a, unsigned short b, unsigned short r) {
  set_zn(r);
  flag_v = (((a ^ r) & (b ^ r) & 0x8000) != 0) ? 1 : 0;
}

static void set_sub_flags(unsigned short a, unsigned short b, unsigned short r) {
  set_zn(r);
  flag_v = (((a ^ b) & (a ^ r) & 0x8000) != 0) ? 1 : 0;
}

static void set_logic_flags(unsigned short r) {
  set_zn(r);
  flag_v = 0;
}

__attribute__((visibility("default"))) void cpu_reset(void) {
  for (int i = 0; i < 8; i++) regs[i] = 0;
  for (int i = 0; i < 65536; i++) mem[i] = 0;
  pc = 0;
  sp = 0xFFFF;
  flag_z = 0;
  flag_n = 0;
  flag_v = 0;
  halted = 0;
}

__attribute__((visibility("default"))) void cpu_load_word(int addr, int word) {
  if (addr < 0) return;
  write16((unsigned short)addr, (unsigned short)word);
}

typedef struct { char name[64]; int addr; } AsmLabel;

static char* asm_trim(char* s) {
  while (*s && isspace((unsigned char)*s)) s++;
  char* e = s + strlen(s);
  while (e > s && isspace((unsigned char)e[-1])) e--;
  *e = '\0';
  return s;
}

static int asm_parse_reg(const char* t) {
  if (!t || (t[0] != 'R' && t[0] != 'r') || !t[1] || t[2]) return -1;
  if (t[1] < '0' || t[1] > '7') return -1;
  return t[1] - '0';
}

static int asm_parse_int(const char* t, int* out) {
  if (!t || !*t) return -1;
  if (*t == '#') t++;
  char* end = 0;
  long v = strtol(t, &end, 10);
  if (!end || *end) return -1;
  *out = (int)v;
  return 0;
}

static int asm_find_label(AsmLabel* labels, int label_count, const char* name) {
  for (int i = 0; i < label_count; i++) {
    if (strcmp(labels[i].name, name) == 0) return labels[i].addr;
  }
  return -1;
}

static unsigned short asm_enc_r(int op, int dst, int src, int imm5) {
  return (unsigned short)(((op & 0x1F) << 11) | ((dst & 7) << 8) | ((src & 7) << 5) | (imm5 & 0x1F));
}
static unsigned short asm_enc_j(int op, int addr11) {
  return (unsigned short)(((op & 0x1F) << 11) | (addr11 & 0x7FF));
}
static unsigned short asm_enc_x(int op, int dst) {
  return (unsigned short)(((op & 0x1F) << 11) | ((dst & 7) << 8));
}

static int asm_instr_words(const char* op) {
  if (!op) return -1;
  if (!strcmp(op, "LOAD") || !strcmp(op, "CALL")) return 2;
  return 1;
}

static int asm_resolve(const char* tok, AsmLabel* labels, int label_count, int* out) {
  if (asm_parse_int(tok, out) == 0) return 0;
  int addr = asm_find_label(labels, label_count, tok);
  if (addr < 0) return -1;
  *out = addr;
  return 0;
}

__attribute__((visibility("default"))) int cpu_assemble(const char* src, int src_len, unsigned short* out_words, int max_words) {
  if (!src || src_len <= 0 || !out_words || max_words <= 0) return -1;
  if (src_len > 65536) return -2;

  char* buf = (char*)malloc((size_t)src_len + 1);
  if (!buf) return -3;
  memcpy(buf, src, (size_t)src_len);
  buf[src_len] = '\0';

  AsmLabel labels[1024];
  int label_count = 0;
  int pc = 0;

  for (int pass = 0; pass < 2; pass++) {
    if (pass == 1) pc = 0;
    char* save = 0;
    char* line = strtok_r(buf, "\n", &save);
    while (line) {
      char* comment = strchr(line, ';');
      if (comment) *comment = '\0';
      char* s = asm_trim(line);

      while (*s) {
        char* colon = strchr(s, ':');
        if (!colon) break;
        *colon = '\0';
        char* label = asm_trim(s);
        if (!*label) { free(buf); return -4; }
        if (pass == 0) {
          if (label_count >= 1024) { free(buf); return -5; }
          strncpy(labels[label_count].name, label, 63);
          labels[label_count].name[63] = '\0';
          labels[label_count].addr = pc;
          label_count++;
        }
        s = asm_trim(colon + 1);
      }

      if (*s) {
        for (char* p = s; *p; p++) if (*p == ',') *p = ' ';
        char* tok_save = 0;
        char* op = strtok_r(s, " \t\r", &tok_save);
        if (!op) { line = strtok_r(0, "\n", &save); continue; }
        for (char* p = op; *p; p++) *p = (char)toupper((unsigned char)*p);
        int words = asm_instr_words(op);
        if (words < 0) { free(buf); return -6; }
        if (pass == 1) {
          if ((pc / 2) + words > max_words) { free(buf); return -7; }
          int opv =
            !strcmp(op, "NOP") ? 0x00 : !strcmp(op, "LOAD") ? 0x01 : !strcmp(op, "MOV") ? 0x02 :
            !strcmp(op, "ADD") ? 0x03 : !strcmp(op, "SUB") ? 0x04 : !strcmp(op, "AND") ? 0x05 :
            !strcmp(op, "OR") ? 0x06 : !strcmp(op, "XOR") ? 0x07 : !strcmp(op, "NOT") ? 0x08 :
            !strcmp(op, "SHL") ? 0x09 : !strcmp(op, "SHR") ? 0x0A : !strcmp(op, "CMP") ? 0x0B :
            !strcmp(op, "JMP") ? 0x0C : !strcmp(op, "JZ") ? 0x0D : !strcmp(op, "JNZ") ? 0x0E :
            !strcmp(op, "JN") ? 0x0F : !strcmp(op, "LDR") ? 0x10 : !strcmp(op, "STR") ? 0x11 :
            !strcmp(op, "PUSH") ? 0x12 : !strcmp(op, "POP") ? 0x13 : !strcmp(op, "CALL") ? 0x14 :
            !strcmp(op, "RET") ? 0x15 : !strcmp(op, "HALT") ? 0x16 : -1;
          if (opv < 0) { free(buf); return -8; }

          int idx = pc / 2;
          if (opv == 0x00 || opv == 0x15 || opv == 0x16) {
            out_words[idx] = asm_enc_r(opv, 0, 0, 0);
          } else if (opv == 0x12 || opv == 0x13 || opv == 0x08) {
            char* a = strtok_r(0, " \t\r", &tok_save);
            int rd = asm_parse_reg(a);
            if (rd < 0) { free(buf); return -9; }
            out_words[idx] = asm_enc_r(opv, rd, 0, 0);
          } else if (opv == 0x09 || opv == 0x0A) {
            char* a = strtok_r(0, " \t\r", &tok_save);
            char* b = strtok_r(0, " \t\r", &tok_save);
            int rd = asm_parse_reg(a), imm = 0;
            if (rd < 0 || asm_resolve(b, labels, label_count, &imm) != 0) { free(buf); return -10; }
            out_words[idx] = asm_enc_r(opv, rd, 0, imm);
          } else if (opv >= 0x0C && opv <= 0x0F) {
            char* a = strtok_r(0, " \t\r", &tok_save);
            int addr = 0;
            if (asm_resolve(a, labels, label_count, &addr) != 0) { free(buf); return -11; }
            if (addr < 0 || addr > 0x7FF) { free(buf); return -15; }
            out_words[idx] = asm_enc_j(opv, addr);
          } else if (opv == 0x01) {
            char* a = strtok_r(0, " \t\r", &tok_save);
            char* b = strtok_r(0, " \t\r", &tok_save);
            int rd = asm_parse_reg(a), imm = 0;
            if (rd < 0 || asm_resolve(b, labels, label_count, &imm) != 0) { free(buf); return -12; }
            if (imm < -32768 || imm > 65535) { free(buf); return -16; }
            out_words[idx] = asm_enc_x(opv, rd);
            out_words[idx + 1] = (unsigned short)imm;
          } else if (opv == 0x14) {
            char* a = strtok_r(0, " \t\r", &tok_save);
            int addr = 0;
            if (asm_resolve(a, labels, label_count, &addr) != 0) { free(buf); return -13; }
            if (addr < 0 || addr > 0xFFFF) { free(buf); return -17; }
            out_words[idx] = asm_enc_x(opv, 0);
            out_words[idx + 1] = (unsigned short)addr;
          } else {
            char* a = strtok_r(0, " \t\r", &tok_save);
            char* b = strtok_r(0, " \t\r", &tok_save);
            int rd = asm_parse_reg(a), rs = asm_parse_reg(b);
            if (rd < 0 || rs < 0) { free(buf); return -14; }
            out_words[idx] = asm_enc_r(opv, rd, rs, 0);
          }
        }
        pc += words * 2;
      }

      line = strtok_r(0, "\n", &save);
    }
    if (pass == 0) {
      memcpy(buf, src, (size_t)src_len);
      buf[src_len] = '\0';
    }
  }

  int words_written = pc / 2;
  free(buf);
  return words_written;
}

__attribute__((visibility("default"))) void cpu_set_reg(int idx, int value) {
  if (idx < 0 || idx > 7) return;
  regs[idx] = (unsigned short)value;
}

__attribute__((visibility("default"))) int cpu_get_reg(int idx) {
  if (idx < 0 || idx > 7) return 0;
  return regs[idx];
}

__attribute__((visibility("default"))) int cpu_get_pc(void) { return pc; }
__attribute__((visibility("default"))) int cpu_get_sp(void) { return sp; }
__attribute__((visibility("default"))) int cpu_get_flag_z(void) { return flag_z; }
__attribute__((visibility("default"))) int cpu_get_flag_n(void) { return flag_n; }
__attribute__((visibility("default"))) int cpu_get_flag_v(void) { return flag_v; }

__attribute__((visibility("default"))) int cpu_mem_read16(int addr) {
  if (addr < 0) return 0;
  return read16((unsigned short)addr);
}

__attribute__((visibility("default"))) int cpu_run(int max_cycles) {
  int cycles = 0;
  if (max_cycles <= 0) return 0;

  while (cycles < max_cycles && !halted) {
    unsigned short instr = read16(pc);
    pc = (unsigned short)(pc + 2);

    unsigned short op = (unsigned short)((instr >> 11) & 0x1F);
    unsigned short dst = (unsigned short)((instr >> 8) & 0x07);
    unsigned short src = (unsigned short)((instr >> 5) & 0x07);
    unsigned short imm5 = (unsigned short)(instr & 0x1F);
    unsigned short jaddr = (unsigned short)(instr & 0x7FF);
    cycles++;

    switch (op) {
      case 0x00: // NOP
        break;
      case 0x01: // LOAD
        regs[dst] = read16(pc);
        pc = (unsigned short)(pc + 2);
        break;
      case 0x02: // MOV
        regs[dst] = regs[src];
        break;
      case 0x03: { // ADD
        unsigned short a = regs[dst];
        unsigned short b = regs[src];
        unsigned short r = (unsigned short)(a + b);
        regs[dst] = r;
        set_add_flags(a, b, r);
      } break;
      case 0x04: { // SUB
        unsigned short a = regs[dst];
        unsigned short b = regs[src];
        unsigned short r = (unsigned short)(a - b);
        regs[dst] = r;
        set_sub_flags(a, b, r);
      } break;
      case 0x05: // AND
        regs[dst] = (unsigned short)(regs[dst] & regs[src]);
        set_logic_flags(regs[dst]);
        break;
      case 0x06: // OR
        regs[dst] = (unsigned short)(regs[dst] | regs[src]);
        set_logic_flags(regs[dst]);
        break;
      case 0x07: // XOR
        regs[dst] = (unsigned short)(regs[dst] ^ regs[src]);
        set_logic_flags(regs[dst]);
        break;
      case 0x08: // NOT
        regs[dst] = (unsigned short)(~regs[dst]);
        set_logic_flags(regs[dst]);
        break;
      case 0x09: // SHL
        regs[dst] = (unsigned short)(regs[dst] << (imm5 & 0x0F));
        set_logic_flags(regs[dst]);
        break;
      case 0x0A: // SHR
        regs[dst] = (unsigned short)(regs[dst] >> (imm5 & 0x0F));
        set_logic_flags(regs[dst]);
        break;
      case 0x0B: { // CMP
        unsigned short a = regs[dst];
        unsigned short b = regs[src];
        unsigned short r = (unsigned short)(a - b);
        set_sub_flags(a, b, r);
      } break;
      case 0x0C: // JMP
        pc = jaddr;
        break;
      case 0x0D: // JZ
        if (flag_z) pc = jaddr;
        break;
      case 0x0E: // JNZ
        if (!flag_z) pc = jaddr;
        break;
      case 0x0F: // JN
        if (flag_n) pc = jaddr;
        break;
      case 0x10: // LDR
        regs[dst] = read16(regs[src]);
        break;
      case 0x11: // STR
        write16(regs[dst], regs[src]);
        break;
      case 0x12: // PUSH
        sp = (unsigned short)(sp - 2);
        write16(sp, regs[dst]);
        break;
      case 0x13: // POP
        regs[dst] = read16(sp);
        sp = (unsigned short)(sp + 2);
        break;
      case 0x14: { // CALL
        unsigned short target = read16(pc);
        pc = (unsigned short)(pc + 2);
        sp = (unsigned short)(sp - 2);
        write16(sp, pc);
        pc = target;
      } break;
      case 0x15: // RET
        pc = read16(sp);
        sp = (unsigned short)(sp + 2);
        break;
      case 0x16: // HALT
        halted = 1;
        break;
      default:
        halted = 1;
        break;
    }
  }

  return cycles;
}
