# 16-bit CPU Emulator

> **Goal**: Implement an emulator that satisfies the external behavior defined below.
> The implementation strategy is unrestricted.

## Interface

Your submission must provide the following exported functions:

- `void cpu_reset(void)`
- `void cpu_load_word(int addr, int word)`
- `int cpu_assemble(const char* src, int src_len, uint16_t* out_words, int max_words)`
- `void cpu_set_reg(int idx, int value)`
- `int cpu_get_reg(int idx)`
- `int cpu_get_pc(void)`
- `int cpu_get_sp(void)`
- `int cpu_get_flag_z(void)`
- `int cpu_get_flag_n(void)`
- `int cpu_get_flag_v(void)`
- `int cpu_mem_read16(int addr)`
- `int cpu_run(int max_cycles)`

## Starter Template Note

- The starter is intentionally minimal and includes only light scaffolding.
- Full conformance is required: hidden validation checks the full behavior in this specification.

## Machine Model

- Data width: 16 bits.
- Address width: 16 bits.
- General registers: `R0..R7` (8 registers).
- Program counter: `PC`.
- Stack pointer: `SP`.
- Flags: `Z`, `N`, `V`.
- Memory: 65536 bytes, byte-addressed.
- Address arithmetic wraps modulo `2^16`.
- 16-bit words are little-endian in memory.

## Reset Semantics

`cpu_reset()` sets machine state to:

- `R0..R7 = 0`
- `PC = 0`
- `SP = 0xFFFF`
- `Z = N = V = 0`
- memory bytes = `0`
- halted state cleared

## Load/Read Helpers

- `cpu_load_word(addr, word)`:
  - If `addr` is outside `[0, 65534]`, no effect.
  - Otherwise writes 16-bit `word` at `addr` in little-endian form.
- `cpu_mem_read16(addr)`:
  - If `addr` is outside `[0, 65534]`, returns `0`.
  - Otherwise returns the 16-bit little-endian word at `addr`.

## Register/Flag Accessors

- `cpu_set_reg(idx, value)`: writes low 16 bits to `Ridx` when `idx in [0,7]`, otherwise no effect.
- `cpu_get_reg(idx)`: returns `Ridx` for `idx in [0,7]`, otherwise `0`.
- `cpu_get_pc`, `cpu_get_sp`, `cpu_get_flag_z`, `cpu_get_flag_n`, `cpu_get_flag_v` return current observable values.

## Instruction Encoding

Instructions use a fixed 16-bit primary word with opcode and operand fields laid out as follows.

### Instruction Word Layout

- Opcode: bits `[15:11]` (5 bits)
- R-format fields: `dst=[10:8]`, `src=[7:5]`, `imm5=[4:0]`
- J-format target: `addr11=[10:0]`

## Opcodes

- `NOP=0x00`, `LOAD=0x01`, `MOV=0x02`, `ADD=0x03`, `SUB=0x04`
- `AND=0x05`, `OR=0x06`, `XOR=0x07`, `NOT=0x08`, `SHL=0x09`, `SHR=0x0A`
- `CMP=0x0B`, `JMP=0x0C`, `JZ=0x0D`, `JNZ=0x0E`, `JN=0x0F`
- `LDR=0x10`, `STR=0x11`, `PUSH=0x12`, `POP=0x13`, `CALL=0x14`, `RET=0x15`, `HALT=0x16`
- `VADD=0x17`, `VSUB=0x18`, `VXOR=0x19`

## Execution Semantics

- Fetches a 16-bit instruction at `PC`, then advances `PC += 2` before executing decoded behavior.
- Instruction fetch semantics are defined for any byte address, including odd `PC` values.
- `LOAD` and `CALL` consume an additional extension word (immediate) from current `PC`, then advance `PC += 2`.
- `cpu_run(max_cycles)` executes at most `max_cycles` instructions and returns executed instruction count.
- If `max_cycles <= 0`, returns `0` and executes nothing.
- If halted state is set, execution stops.
- If halted state is already set before `cpu_run(max_cycles)` is called, execution count is `0` and machine state is unchanged.

### State Updates by Instruction

- `NOP`: no state change.
- `LOAD Rd, imm16`: `Rd = imm16`.
- `MOV Rd, Rs`: `Rd = Rs`.
- `ADD Rd, Rs`: `Rd = Rd + Rs` (16-bit wrap).
- `SUB Rd, Rs`: `Rd = Rd - Rs` (16-bit wrap).
- `AND/OR/XOR Rd, Rs`: bitwise op into `Rd`.
- `NOT Rd`: bitwise inversion of `Rd`.
- `SHL/SHR Rd, imm5`: shift `Rd` by `(imm5 mod 16)`.
- `CMP Rd, Rs`: computes `Rd - Rs` for flags only; registers unchanged.
- `JMP addr11`: `PC = addr11`.
- `JZ/JNZ/JN addr11`: conditional `PC = addr11` based on `Z / !Z / N`.
- `LDR Rd, Rs`: `Rd = mem16[Rs]`.
- `STR Rd, Rs`: `mem16[Rd] = Rs`.
- `PUSH Rd`: `SP -= 2`; `mem16[SP] = Rd`.
- `POP Rd`: `Rd = mem16[SP]`; `SP += 2`.
- `CALL imm16`: push return address (`PC` after extension), then `PC = imm16`.
- `RET`: `PC = mem16[SP]`; `SP += 2`.
- `HALT`: sets halted state.
- `VADD Vd, Vs`: lane-wise 16-bit add on packed vectors.
- `VSUB Vd, Vs`: lane-wise 16-bit subtract on packed vectors.
- `VXOR Vd, Vs`: lane-wise bitwise xor on packed vectors.

### SIMD Register Model

- SIMD uses packed lanes inside existing registers.
- Vector base registers are only `R0` and `R4`.
- `V0` is represented by base `R0` and maps to lanes `(R0, R1, R2, R3)`.
- `V1` is represented by base `R4` and maps to lanes `(R4, R5, R6, R7)`.
- For SIMD instructions, operands must be base registers (`R0` or `R4`) only.
- Lane arithmetic wraps modulo `2^16`.

### Deterministic Invalid Encoding Behavior

- Unknown opcodes are invalid and must halt execution.
- SIMD opcodes (`VADD`, `VSUB`, `VXOR`) using non-base register operands (`dst/src` not in `{R0, R4}`) are invalid encodings and must halt execution immediately.

### Odd Address and Wraparound Fetch

- `PC`, `SP`, and internal address arithmetic are modulo `2^16`.
- Fetches, extension-word reads (`LOAD`/`CALL`), and stack/memory accesses may cross the `0xFFFF -> 0x0000` boundary and follow little-endian byte semantics.

### Flag Semantics

- `ADD`, `SUB`, `CMP` update `Z`, `N`, `V`.
- `AND`, `OR`, `XOR`, `NOT`, `SHL`, `SHR` update `Z`, `N` and set `V = 0`.
- `VADD`, `VSUB`, `VXOR` do not modify `Z`, `N`, or `V`.
- `LOAD`, `MOV`, `LDR`, `STR`, `PUSH`, `POP`, `CALL`, `RET`, `NOP`, `HALT` do not modify flags.
- `Z = 1` iff result equals `0` (16-bit).
- `N = 1` iff bit 15 of result is `1`.
- `V`:
  - ADD overflow iff `((a ^ r) & (b ^ r) & 0x8000) != 0`
  - SUB/CMP overflow iff `((a ^ b) & (a ^ r) & 0x8000) != 0`

## Assembler Contract

`cpu_assemble(src, src_len, out_words, max_words)`:

- Input text is assembly using mnemonics above, optional labels (`name:`), decimal immediates, optional `#` prefix, and `;` comments.
- Implementations must support large valid programs. Validation may provide sources with at least 20,000 labels and output sizes above 20,000 words.
- Returns number of encoded words on success.
- Returns a negative value on parse/encode/validation error.
- Must not write beyond `max_words` entries in `out_words`.

### Assembler Validity Rules

- Invalid register names are errors.
- SIMD register operands must be `R0` or `R4`; any other SIMD operand register is an error.
- Unknown mnemonics are errors.
- Undefined labels are errors.
- Duplicate labels are errors.
- Encodings must obey field ranges:
  - `JMP/JZ/JNZ/JN` target must be in `[0, 0x07FF]`.
  - `LOAD` immediate must be in `[-32768, 65535]`.
  - `CALL` target must be in `[0, 0xFFFF]`.
- `max_words` insufficiency is an error: assembler must return a negative value and must not write beyond `max_words`.
- Immediate forms `value` and `#value` are both valid (including negative values within range).

## Evaluation Model

- Validation is black-box: hidden programs call the exported API and compare observable behavior against this specification.
- Passing requires conformance to all externally observable semantics above.
