static unsigned short regs[8];
static unsigned short pc = 0;
static unsigned short sp = 0xFFFF;
static unsigned short mem[32768];
static int flag_z = 0;
static int flag_n = 0;
static int flag_v = 0;

extern "C" __attribute__((visibility("default"))) void cpu_reset() {
  for (int i = 0; i < 8; i++) regs[i] = 0;
  for (int i = 0; i < 32768; i++) mem[i] = 0;
  pc = 0;
  sp = 0xFFFF;
  flag_z = 0;
  flag_n = 0;
  flag_v = 0;
}

extern "C" __attribute__((visibility("default"))) void cpu_load_word(int addr, int word) {
  if (addr < 0 || addr > 65534) return;
  unsigned short a = (unsigned short)addr;
  unsigned short w = (unsigned short)word;
  ((unsigned char*)mem)[a] = (unsigned char)(w & 0xFF);
  ((unsigned char*)mem)[(unsigned short)(a + 1)] = (unsigned char)((w >> 8) & 0xFF);
}

extern "C" __attribute__((visibility("default"))) int cpu_assemble(const char* src, int src_len, unsigned short* out_words, int max_words) {
  // TODO: implement two-pass assembler; return words written or negative on error.
  (void)src; (void)src_len; (void)out_words; (void)max_words;
  return -1;
}

extern "C" __attribute__((visibility("default"))) void cpu_set_reg(int idx, int value) {
  if (idx < 0 || idx > 7) return;
  regs[idx] = (unsigned short)value;
}
extern "C" __attribute__((visibility("default"))) int cpu_get_reg(int idx) {
  if (idx < 0 || idx > 7) return 0;
  return regs[idx];
}
extern "C" __attribute__((visibility("default"))) int cpu_get_pc() { return pc; }
extern "C" __attribute__((visibility("default"))) int cpu_get_sp() { return sp; }
extern "C" __attribute__((visibility("default"))) int cpu_get_flag_z() { return flag_z; }
extern "C" __attribute__((visibility("default"))) int cpu_get_flag_n() { return flag_n; }
extern "C" __attribute__((visibility("default"))) int cpu_get_flag_v() { return flag_v; }
extern "C" __attribute__((visibility("default"))) int cpu_mem_read16(int addr) {
  if (addr < 0 || addr > 65534) return 0;
  unsigned short a = (unsigned short)addr;
  unsigned short lo = (unsigned short)((unsigned char*)mem)[a];
  unsigned short hi = (unsigned short)((unsigned char*)mem)[(unsigned short)(a + 1)];
  return (int)((hi << 8) | lo);
}

extern "C" __attribute__((visibility("default"))) int cpu_run(int max_cycles) {
  // TODO: implement full emulator.
  (void)max_cycles;
  return 0;
}
