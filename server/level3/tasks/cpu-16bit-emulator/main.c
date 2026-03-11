#include <stdint.h>

/*
 * Candidate starter template.
 * Implement the required CPU behavior from the spec.
 */

void ct_reset_state(void);
void ct_load_word(int addr, int word);
void ct_set_reg(int idx, int value);
int ct_get_reg(int idx);
int ct_get_pc(void);
int ct_get_sp(void);
int ct_get_flag_z(void);
int ct_get_flag_n(void);
int ct_get_flag_v(void);
int ct_mem_read16(int addr);

__attribute__((visibility("default"))) void cpu_reset(void) {
  ct_reset_state();
}

__attribute__((visibility("default"))) void cpu_load_word(int addr, int word) {
  ct_load_word(addr, word);
}

__attribute__((visibility("default"))) int
cpu_assemble(const char *src, int src_len, uint16_t *out_words, int max_words) {
  // TODO: implement two-pass assembler; return words written or negative on
  // error.
  (void)src;
  (void)src_len;
  (void)out_words;
  (void)max_words;
  return -1;
}

__attribute__((visibility("default"))) void cpu_set_reg(int idx, int value) {
  ct_set_reg(idx, value);
}

__attribute__((visibility("default"))) int cpu_get_reg(int idx) {
  return ct_get_reg(idx);
}

__attribute__((visibility("default"))) int cpu_get_pc(void) {
  return ct_get_pc();
}

__attribute__((visibility("default"))) int cpu_get_sp(void) {
  return ct_get_sp();
}

__attribute__((visibility("default"))) int cpu_get_flag_z(void) {
  return ct_get_flag_z();
}

__attribute__((visibility("default"))) int cpu_get_flag_n(void) {
  return ct_get_flag_n();
}

__attribute__((visibility("default"))) int cpu_get_flag_v(void) {
  return ct_get_flag_v();
}

__attribute__((visibility("default"))) int cpu_mem_read16(int addr) {
  return ct_mem_read16(addr);
}

__attribute__((visibility("default"))) int cpu_run(int max_cycles) {
  // TODO: implement full emulator.
  (void)max_cycles;
  return 0;
}
