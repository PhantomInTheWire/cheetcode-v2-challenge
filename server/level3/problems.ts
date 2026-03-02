export type Level3Check = {
  id: string;
  name: string;
  exportName: string;
};

export type Level3Challenge = {
  id: string;
  title: string;
  taskId: string;
  taskName: string;
  language: string;
  spec: string;
  checks: Level3Check[];
  starterCode: string;
};

type Level3TaskTemplate = {
  id: string;
  name: string;
  specTemplate: string;
  checks: Array<{
    key: string;
    name: string;
    exportName: string;
  }>;
};

const LANGUAGES = ["C", "C++", "Rust"];

const TASKS: Level3TaskTemplate[] = [
  {
    id: "cpu-16bit-emulator",
    name: "16-bit CPU Emulator",
    specTemplate: [
      "Implement a complete 16-bit CPU emulator in {language}.",
      "",
      "Constraints",
      "- Single flat file only (main.{ext}).",
      "- No external dependencies.",
      "- Evaluator compiles and runs your code natively inside an isolated VM.",
      "- Total challenge time: 2 minutes.",
      "",
      "Architecture (authoritative)",
      "- Data width: 16 bits; address width: 16 bits.",
      "- Registers: R0..R7 (8 x 16-bit), PC (16-bit), SP (16-bit).",
      "- Flags: Z(bit0), N(bit1), V(bit2).",
      "- Memory: 64KB byte-addressable, little-endian word layout, no alignment requirement.",
      "- Address arithmetic wraps modulo 2^16.",
      "",
      "Instruction Set and Semantics",
      "- Opcodes: NOP LOAD MOV ADD SUB AND OR XOR NOT SHL SHR CMP JMP JZ JNZ JN LDR STR PUSH POP CALL RET HALT.",
      "- Formats: R(16-bit), J(16-bit), I extension for LOAD/CALL (32-bit total).",
      "- PC is byte-addressed and increments by 2 after each fetched 16-bit word.",
      "- LOAD/MOV/LDR/STR/PUSH/POP do not modify flags.",
      "- ADD/SUB/CMP update Z,N,V (V uses signed overflow formulas).",
      "- AND/OR/XOR/NOT/SHL/SHR update Z,N and clear V.",
      "- SHL/SHR shift amount is imm5 mod 16.",
      "- PUSH: SP-=2; [SP]=word. POP: Rd=[SP]; SP+=2.",
      "- CALL pushes return PC (instruction after CALL), then sets PC=imm16.",
      "- RET pops PC from stack.",
      "",
      "Native Harness ABI (required exports)",
      "- void cpu_reset(void)",
      "- void cpu_load_word(int addr, int word)",
      "- void cpu_set_reg(int idx, int value)",
      "- int cpu_get_reg(int idx)",
      "- int cpu_get_pc(void)",
      "- int cpu_get_sp(void)",
      "- int cpu_get_flag_z(void)",
      "- int cpu_get_flag_n(void)",
      "- int cpu_get_flag_v(void)",
      "- int cpu_mem_read16(int addr)",
      "- int cpu_run(int max_cycles)    // returns executed cycles",
      "",
      "Evaluation",
      "- Hidden harness executes deterministic and randomized programs against the emulator.",
      "- Checks include ABI/reset, arithmetic flags, logical/shift flags, branch/control flow, stack/call/ret, memory wraparound, end-to-end program behavior, randomized property tests, and benchmark constraints.",
      "- Hardcoded constants or fixed outputs will fail.",
    ].join("\n"),
    checks: [
      {
        key: "abi",
        name: "ABI exports and reset semantics",
        exportName: "cpu_reset",
      },
      {
        key: "arith",
        name: "Arithmetic and Z/N/V flag behavior",
        exportName: "cpu_get_flag_v",
      },
      {
        key: "logic",
        name: "Logical/shift semantics and V clearing",
        exportName: "cpu_get_flag_z",
      },
      {
        key: "branch",
        name: "Conditional branching control flow",
        exportName: "cpu_get_pc",
      },
      {
        key: "stack",
        name: "Stack and CALL/RET discipline",
        exportName: "cpu_get_sp",
      },
      {
        key: "memory",
        name: "Little-endian and wraparound memory behavior",
        exportName: "cpu_mem_read16",
      },
      {
        key: "programs",
        name: "End-to-end deterministic program execution",
        exportName: "cpu_run",
      },
      {
        key: "random",
        name: "Randomized ALU property checks",
        exportName: "cpu_get_reg",
      },
      {
        key: "benchmark",
        name: "Cycle budget and benchmark constraints",
        exportName: "cpu_run",
      },
    ],
  },
];

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function starterCodeFor(language: string): string {
  if (language === "C") {
    return [
      "static unsigned short regs[8];",
      "static unsigned short pc = 0;",
      "static unsigned short sp = 0xFFFF;",
      "static unsigned short mem[32768];",
      "static int flag_z = 0;",
      "static int flag_n = 0;",
      "static int flag_v = 0;",
      "",
      "__attribute__((visibility(\"default\"))) void cpu_reset(void) {",
      "  for (int i = 0; i < 8; i++) regs[i] = 0;",
      "  for (int i = 0; i < 32768; i++) mem[i] = 0;",
      "  pc = 0;",
      "  sp = 0xFFFF;",
      "  flag_z = 0;",
      "  flag_n = 0;",
      "  flag_v = 0;",
      "}",
      "",
      "__attribute__((visibility(\"default\"))) void cpu_load_word(int addr, int word) {",
      "  if (addr < 0 || addr > 0xFFFE || (addr & 1)) return;",
      "  mem[(unsigned short)addr >> 1] = (unsigned short)word;",
      "}",
      "",
      "__attribute__((visibility(\"default\"))) void cpu_set_reg(int idx, int value) {",
      "  if (idx < 0 || idx > 7) return;",
      "  regs[idx] = (unsigned short)value;",
      "}",
      "__attribute__((visibility(\"default\"))) int cpu_get_reg(int idx) {",
      "  if (idx < 0 || idx > 7) return 0;",
      "  return regs[idx];",
      "}",
      "__attribute__((visibility(\"default\"))) int cpu_get_pc(void) { return pc; }",
      "__attribute__((visibility(\"default\"))) int cpu_get_sp(void) { return sp; }",
      "__attribute__((visibility(\"default\"))) int cpu_get_flag_z(void) { return flag_z; }",
      "__attribute__((visibility(\"default\"))) int cpu_get_flag_n(void) { return flag_n; }",
      "__attribute__((visibility(\"default\"))) int cpu_get_flag_v(void) { return flag_v; }",
      "__attribute__((visibility(\"default\"))) int cpu_mem_read16(int addr) {",
      "  if (addr < 0 || addr > 0xFFFE || (addr & 1)) return 0;",
      "  return mem[(unsigned short)addr >> 1];",
      "}",
      "",
      "__attribute__((visibility(\"default\"))) int cpu_run(int max_cycles) {",
      "  // TODO: implement full emulator.",
      "  (void)max_cycles;",
      "  return 0;",
      "}",
    ].join("\n");
  }

  if (language === "C++") {
    return [
      "static unsigned short regs[8];",
      "static unsigned short pc = 0;",
      "static unsigned short sp = 0xFFFF;",
      "static unsigned short mem[32768];",
      "static int flag_z = 0;",
      "static int flag_n = 0;",
      "static int flag_v = 0;",
      "",
      "extern \"C\" __attribute__((visibility(\"default\"))) void cpu_reset() {",
      "  for (int i = 0; i < 8; i++) regs[i] = 0;",
      "  for (int i = 0; i < 32768; i++) mem[i] = 0;",
      "  pc = 0;",
      "  sp = 0xFFFF;",
      "  flag_z = 0;",
      "  flag_n = 0;",
      "  flag_v = 0;",
      "}",
      "",
      "extern \"C\" __attribute__((visibility(\"default\"))) void cpu_load_word(int addr, int word) {",
      "  if (addr < 0 || addr > 0xFFFE || (addr & 1)) return;",
      "  mem[(unsigned short)addr >> 1] = (unsigned short)word;",
      "}",
      "",
      "extern \"C\" __attribute__((visibility(\"default\"))) void cpu_set_reg(int idx, int value) {",
      "  if (idx < 0 || idx > 7) return;",
      "  regs[idx] = (unsigned short)value;",
      "}",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_get_reg(int idx) {",
      "  if (idx < 0 || idx > 7) return 0;",
      "  return regs[idx];",
      "}",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_get_pc() { return pc; }",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_get_sp() { return sp; }",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_get_flag_z() { return flag_z; }",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_get_flag_n() { return flag_n; }",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_get_flag_v() { return flag_v; }",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_mem_read16(int addr) {",
      "  if (addr < 0 || addr > 0xFFFE || (addr & 1)) return 0;",
      "  return mem[(unsigned short)addr >> 1];",
      "}",
      "",
      "extern \"C\" __attribute__((visibility(\"default\"))) int cpu_run(int max_cycles) {",
      "  // TODO: implement full emulator.",
      "  (void)max_cycles;",
      "  return 0;",
      "}",
    ].join("\n");
  }

  return [
    "static mut REGS: [u16; 8] = [0; 8];",
    "static mut MEM: [u16; 32768] = [0; 32768];",
    "static mut PC: u16 = 0;",
    "static mut SP: u16 = 0xFFFF;",
    "static mut FLAG_Z: i32 = 0;",
    "static mut FLAG_N: i32 = 0;",
    "static mut FLAG_V: i32 = 0;",
    "",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_reset() {",
    "    unsafe {",
    "        REGS = [0; 8];",
    "        MEM = [0; 32768];",
    "        PC = 0;",
    "        SP = 0xFFFF;",
    "        FLAG_Z = 0;",
    "        FLAG_N = 0;",
    "        FLAG_V = 0;",
    "    }",
    "}",
    "",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_load_word(addr: i32, word: i32) {",
    "    if addr < 0 || addr > 0xFFFE || (addr & 1) != 0 { return; }",
    "    unsafe { MEM[(addr as usize) >> 1] = word as u16; }",
    "}",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_set_reg(idx: i32, value: i32) {",
    "    if !(0..=7).contains(&idx) { return; }",
    "    unsafe { REGS[idx as usize] = value as u16; }",
    "}",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_get_reg(idx: i32) -> i32 {",
    "    if !(0..=7).contains(&idx) { return 0; }",
    "    unsafe { REGS[idx as usize] as i32 }",
    "}",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_get_pc() -> i32 { unsafe { PC as i32 } }",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_get_sp() -> i32 { unsafe { SP as i32 } }",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_get_flag_z() -> i32 { unsafe { FLAG_Z } }",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_get_flag_n() -> i32 { unsafe { FLAG_N } }",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_get_flag_v() -> i32 { unsafe { FLAG_V } }",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_mem_read16(addr: i32) -> i32 {",
    "    if addr < 0 || addr > 0xFFFE || (addr & 1) != 0 { return 0; }",
    "    unsafe { MEM[(addr as usize) >> 1] as i32 }",
    "}",
    "",
    "#[no_mangle]",
    "pub extern \"C\" fn cpu_run(max_cycles: i32) -> i32 {",
    "    // TODO: implement full emulator.",
    "    let _ = max_cycles;",
    "    0",
    "}",
  ].join("\n");
}

function languageToKey(language: string): string {
  return language.toLowerCase().replace(/\+\+/g, "pp");
}

function keyToLanguage(key: string): string | null {
  if (key === "c") return "C";
  if (key === "cpp") return "C++";
  if (key === "rust") return "Rust";
  return null;
}

export function generateLevel3Challenge(): Level3Challenge {
  const language = randomPick(LANGUAGES);
  const task = randomPick(TASKS);
  const challengeId = `l3:${task.id}:${languageToKey(language)}`;
  const spec = task.specTemplate.replaceAll("{language}", language);
  const checks: Level3Check[] = task.checks.map((check) => ({
    id: `${challengeId}:${check.key}`,
    name: check.name,
    exportName: check.exportName,
  }));

  return {
    id: challengeId,
    title: "Level 3 Systems Spec",
    taskId: task.id,
    taskName: task.name,
    language,
    spec,
    checks,
    starterCode: starterCodeFor(language),
  };
}

export function getLevel3ChallengeFromId(challengeId: string): Level3Challenge | null {
  const [, taskId, languageKey] = challengeId.split(":");
  const task = TASKS.find((t) => t.id === taskId);
  const language = languageKey ? keyToLanguage(languageKey) : null;
  if (!task || !language) return null;

  const spec = task.specTemplate.replaceAll("{language}", language);
  const checks: Level3Check[] = task.checks.map((check) => ({
    id: `${challengeId}:${check.key}`,
    name: check.name,
    exportName: check.exportName,
  }));

  return {
    id: challengeId,
    title: "Level 3 Systems Spec",
    taskId: task.id,
    taskName: task.name,
    language,
    spec,
    checks,
    starterCode: starterCodeFor(language),
  };
}
