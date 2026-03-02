import { SPEC_TEMPLATE, STARTER_C, STARTER_CPP, STARTER_RS } from "./assetStrings";

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
    specTemplate: SPEC_TEMPLATE,
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

function languageToKey(language: string): string {
  return language.toLowerCase().replace(/\+\+/g, "pp");
}

function keyToLanguage(key: string): string | null {
  if (key === "c") return "C";
  if (key === "cpp") return "C++";
  if (key === "rust") return "Rust";
  return null;
}

function languageToExt(language: string): string {
  if (language === "C") return "c";
  if (language === "C++") return "cpp";
  return "rs";
}

function starterCodeFor(language: string): string {
  if (language === "C") return STARTER_C;
  if (language === "C++") return STARTER_CPP;
  return STARTER_RS;
}

function renderSpec(specTemplate: string, language: string): string {
  return specTemplate
    .replaceAll("{language}", language)
    .replaceAll("{ext}", languageToExt(language));
}

export function generateLevel3Challenge(): Level3Challenge {
  const language = randomPick(LANGUAGES);
  const task = randomPick(TASKS);
  const challengeId = `l3:${task.id}:${languageToKey(language)}`;
  const spec = renderSpec(task.specTemplate, language);
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

  const spec = renderSpec(task.specTemplate, language);
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
