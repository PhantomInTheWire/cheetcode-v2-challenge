Implement a complete 16-bit CPU emulator in {language}.

Constraints
- Single flat file only (main.{ext}).
- No external dependencies.
- Evaluator compiles and runs your code natively inside an isolated VM.
- Total challenge time: 2 minutes.

Architecture (authoritative)
- Data width: 16 bits; address width: 16 bits.
- Registers: R0..R7 (8 x 16-bit), PC (16-bit), SP (16-bit).
- Flags: Z(bit0), N(bit1), V(bit2).
- Memory: 64KB byte-addressable, little-endian word layout, no alignment requirement.
- Address arithmetic wraps modulo 2^16.

Instruction Set and Semantics
- Opcodes: NOP LOAD MOV ADD SUB AND OR XOR NOT SHL SHR CMP JMP JZ JNZ JN LDR STR PUSH POP CALL RET HALT.
- Formats: R(16-bit), J(16-bit word with 11-bit absolute byte target), I extension for LOAD/CALL (32-bit total).
- PC is byte-addressed and increments by 2 after each fetched 16-bit word.
- LOAD/MOV/LDR/STR/PUSH/POP do not modify flags.
- ADD/SUB/CMP update Z,N,V (V uses signed overflow formulas).
- AND/OR/XOR/NOT/SHL/SHR update Z,N and clear V.
- SHL/SHR shift amount is imm5 mod 16.
- PUSH: SP-=2; [SP]=word. POP: Rd=[SP]; SP+=2.
- CALL pushes return PC (instruction after CALL), then sets PC=imm16.
- RET pops PC from stack.

Native Harness ABI (required exports)
- void cpu_reset(void)
- void cpu_load_word(int addr, int word)
- int cpu_assemble(const char* src, int src_len, uint16_t* out_words, int max_words)
  Returns number of words written, or negative on parse/encode error.
  Assembler input syntax is the architecture assembly in this spec (labels, decimal immediates, mnemonics).
- void cpu_set_reg(int idx, int value)
- int cpu_get_reg(int idx)
- int cpu_get_pc(void)
- int cpu_get_sp(void)
- int cpu_get_flag_z(void)
- int cpu_get_flag_n(void)
- int cpu_get_flag_v(void)
- int cpu_mem_read16(int addr)
- int cpu_run(int max_cycles)    // returns executed cycles

Evaluation
- Hidden harness executes deterministic and randomized programs against the emulator.
- Hidden harness also assembles text assembly programs through cpu_assemble(...) and then executes them.
- Checks include ABI/reset, arithmetic flags, logical/shift flags, branch/control flow, stack/call/ret,
  memory wraparound, end-to-end program behavior, randomized property tests, and benchmark constraints.
- Hardcoded constants or fixed outputs will fail.
