export type Level3CheckTemplate = {
  key: string;
  name: string;
  exportName: string;
};

export type Level3TaskTemplate = {
  id: string;
  name: string;
  checks: Level3CheckTemplate[];
};

export type Level3Check = {
  id: string;
  name: string;
  exportName: string;
};

export type Level3ChallengeMeta = {
  id: string;
  title: string;
  taskId: string;
  taskName: string;
  language: string;
  checks: Level3Check[];
};

export const LEVEL3_LANGUAGES = ["C", "C++", "Rust"] as const;

export const LEVEL3_TASKS: Level3TaskTemplate[] = [
  {
    id: "cpu-16bit-emulator",
    name: "16-bit CPU Emulator",
    checks: [
      { key: "abi_reset", name: "Reset state semantics", exportName: "cpu_reset" },
      {
        key: "arith_add_overflow",
        name: "ADD overflow flag behavior",
        exportName: "cpu_get_flag_v",
      },
      {
        key: "arith_sub_overflow",
        name: "SUB overflow flag behavior",
        exportName: "cpu_get_flag_v",
      },
      { key: "arith_cmp_flags", name: "CMP flag-only behavior", exportName: "cpu_get_flag_n" },
      { key: "logic_bitwise", name: "Bitwise logical operations", exportName: "cpu_get_reg" },
      { key: "logic_shifts", name: "Shift semantics and flags", exportName: "cpu_get_flag_z" },
      { key: "logic_v_clear", name: "Logical ops clear V flag", exportName: "cpu_get_flag_v" },
      { key: "branch_jnz_loop", name: "JNZ loop control flow", exportName: "cpu_get_pc" },
      { key: "branch_jn_taken", name: "JN negative branch behavior", exportName: "cpu_get_pc" },
      { key: "stack_push_pop", name: "Stack push/pop behavior", exportName: "cpu_get_sp" },
      { key: "stack_call_ret", name: "CALL/RET discipline", exportName: "cpu_get_sp" },
      {
        key: "memory_wraparound",
        name: "Memory wraparound semantics",
        exportName: "cpu_mem_read16",
      },
      {
        key: "memory_unaligned",
        name: "Memory unaligned word semantics",
        exportName: "cpu_mem_read16",
      },
      {
        key: "programs_asm1",
        name: "Assembler program: basic ALU/data path",
        exportName: "cpu_assemble",
      },
      { key: "programs_asm2", name: "Assembler program: loop/sum", exportName: "cpu_assemble" },
      { key: "programs_asm3", name: "Assembler program: nested calls", exportName: "cpu_assemble" },
      {
        key: "programs_asm4",
        name: "Assembler program: branch+memory",
        exportName: "cpu_assemble",
      },
      {
        key: "programs_invalid_reject",
        name: "Assembler rejects invalid source",
        exportName: "cpu_assemble",
      },
      { key: "random_alu", name: "Randomized ALU property checks", exportName: "cpu_get_reg" },
      { key: "benchmark_budget", name: "Cycle/timing budget constraints", exportName: "cpu_run" },
    ],
  },
];

function randomPick<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("randomPick requires at least one item");
  }
  return items[Math.floor(Math.random() * items.length)];
}

export function languageToKey(language: string): string {
  return language.toLowerCase().replace(/\+\+/g, "pp");
}

export function keyToLanguage(key: string): string | null {
  if (key === "c") return "C";
  if (key === "cpp") return "C++";
  if (key === "rust") return "Rust";
  return null;
}

function checksFor(challengeId: string, task: Level3TaskTemplate): Level3Check[] {
  return task.checks.map((check) => ({
    id: `${challengeId}:${check.key}`,
    name: check.name,
    exportName: check.exportName,
  }));
}

export function generateLevel3ChallengeMeta(): Level3ChallengeMeta {
  const language = randomPick([...LEVEL3_LANGUAGES]);
  const task = randomPick(LEVEL3_TASKS);
  const challengeId = `l3:${task.id}:${languageToKey(language)}`;
  return {
    id: challengeId,
    title: "Level 3 Systems Spec",
    taskId: task.id,
    taskName: task.name,
    language,
    checks: checksFor(challengeId, task),
  };
}

export function getLevel3ChallengeMetaFromId(challengeId: string): Level3ChallengeMeta | null {
  const [, taskId, languageKey] = challengeId.split(":");
  const task = LEVEL3_TASKS.find((t) => t.id === taskId);
  const language = languageKey ? keyToLanguage(languageKey) : null;
  if (!task || !language) return null;
  return {
    id: challengeId,
    title: "Level 3 Systems Spec",
    taskId: task.id,
    taskName: task.name,
    language,
    checks: checksFor(challengeId, task),
  };
}
