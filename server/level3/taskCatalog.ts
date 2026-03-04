import { LEVEL3_TOTAL } from "../../src/lib/constants";

export const LEVEL3_SUPPORTED_LANGUAGES = ["C", "C++", "Rust"] as const;

type Level3SupportedLanguage = (typeof LEVEL3_SUPPORTED_LANGUAGES)[number];

export type Level3TaskCheckTemplate = {
  key: string;
  name: string;
  exportName: string;
};

export type Level3TaskTemplate = {
  id: string;
  name: string;
  title?: string;
  enabled: boolean;
  languages: Level3SupportedLanguage[];
  checks: Level3TaskCheckTemplate[];
};

const RAW_LEVEL3_TASK_CATALOG: Level3TaskTemplate[] = [
  {
    id: "cpu-16bit-emulator",
    name: "16-bit CPU Emulator",
    title: "Level 3 Systems Spec",
    enabled: true,
    languages: ["C", "C++", "Rust"],
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
      { key: "branch_jnz_loop", name: "JNZ loop control flow", exportName: "cpu_get_pc" },
      { key: "branch_jn_taken", name: "JN negative branch behavior", exportName: "cpu_get_pc" },
      { key: "stack_push_pop", name: "Stack push/pop behavior", exportName: "cpu_get_sp" },
      { key: "stack_call_ret", name: "CALL/RET discipline", exportName: "cpu_get_sp" },
      {
        key: "memory_wraparound",
        name: "Core wraparound and helper bounds",
        exportName: "cpu_mem_read16",
      },
      {
        key: "memory_unaligned",
        name: "Memory unaligned word semantics",
        exportName: "cpu_mem_read16",
      },
      {
        key: "helper_load_word_bounds",
        name: "Helper load-word address bounds",
        exportName: "cpu_load_word",
      },
      {
        key: "helper_mem_read_bounds",
        name: "Helper mem-read address bounds",
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
      {
        key: "assembler_large_labels",
        name: "Assembler handles large label sets",
        exportName: "cpu_assemble",
      },
      { key: "random_alu", name: "Randomized ALU property checks", exportName: "cpu_get_reg" },
      { key: "benchmark_budget", name: "Cycle/timing budget constraints", exportName: "cpu_run" },
      { key: "perf_run_throughput", name: "Run throughput benchmark", exportName: "cpu_run" },
      {
        key: "perf_asm_label_lookup",
        name: "Assembler label lookup benchmark",
        exportName: "cpu_assemble",
      },
      {
        key: "perf_asm_mnemonic_decode",
        name: "Assembler mnemonic decode benchmark",
        exportName: "cpu_assemble",
      },
    ],
  },
];

function assertNonEmptyString(value: unknown, message: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
}

function assertSupportedLanguage(
  language: unknown,
  taskId: string,
): asserts language is Level3SupportedLanguage {
  if (!LEVEL3_SUPPORTED_LANGUAGES.includes(language as Level3SupportedLanguage)) {
    throw new Error(`Invalid level3 task '${taskId}': unsupported language '${String(language)}'`);
  }
}

export function validateLevel3TaskCatalog(rawCatalog: unknown): Level3TaskTemplate[] {
  if (!Array.isArray(rawCatalog)) {
    throw new Error("Invalid level3 task catalog: expected array");
  }

  const seenTaskIds = new Set<string>();

  const catalog = rawCatalog.map((rawTask, taskIndex) => {
    if (!rawTask || typeof rawTask !== "object") {
      throw new Error(`Invalid level3 task at index ${taskIndex}: expected object`);
    }

    const task = rawTask as Partial<Level3TaskTemplate>;
    assertNonEmptyString(task.id, `Invalid level3 task at index ${taskIndex}: id must be non-empty string`);

    if (seenTaskIds.has(task.id)) {
      throw new Error(`Invalid level3 task catalog: duplicate task id '${task.id}'`);
    }
    seenTaskIds.add(task.id);

    assertNonEmptyString(task.name, `Invalid level3 task '${task.id}': name must be non-empty string`);

    if (task.title !== undefined && (typeof task.title !== "string" || task.title.trim().length === 0)) {
      throw new Error(`Invalid level3 task '${task.id}': title must be a non-empty string when provided`);
    }

    if (typeof task.enabled !== "boolean") {
      throw new Error(`Invalid level3 task '${task.id}': enabled must be boolean`);
    }

    if (!Array.isArray(task.languages) || task.languages.length === 0) {
      throw new Error(`Invalid level3 task '${task.id}': languages must be a non-empty array`);
    }

    const seenLanguages = new Set<string>();
    const languages = task.languages.map((language) => {
      assertSupportedLanguage(language, task.id);
      if (seenLanguages.has(language)) {
        throw new Error(`Invalid level3 task '${task.id}': duplicate language '${language}'`);
      }
      seenLanguages.add(language);
      return language;
    });

    if (!Array.isArray(task.checks) || task.checks.length === 0) {
      throw new Error(`Invalid level3 task '${task.id}': checks must be a non-empty array`);
    }

    if (task.enabled && task.checks.length !== LEVEL3_TOTAL) {
      throw new Error(
        `Invalid level3 task '${task.id}': enabled tasks must define exactly ${LEVEL3_TOTAL} checks`,
      );
    }

    const seenCheckKeys = new Set<string>();
    const checks = task.checks.map((check, checkIndex) => {
      if (!check || typeof check !== "object") {
        throw new Error(`Invalid level3 task '${task.id}' check at index ${checkIndex}: expected object`);
      }
      const candidate = check as Partial<Level3TaskCheckTemplate>;
      assertNonEmptyString(
        candidate.key,
        `Invalid level3 task '${task.id}' check at index ${checkIndex}: key must be non-empty string`,
      );
      assertNonEmptyString(
        candidate.name,
        `Invalid level3 task '${task.id}' check '${candidate.key}': name must be non-empty string`,
      );
      assertNonEmptyString(
        candidate.exportName,
        `Invalid level3 task '${task.id}' check '${candidate.key}': exportName must be non-empty string`,
      );
      if (seenCheckKeys.has(candidate.key)) {
        throw new Error(`Invalid level3 task '${task.id}': duplicate check key '${candidate.key}'`);
      }
      seenCheckKeys.add(candidate.key);
      return {
        key: candidate.key,
        name: candidate.name,
        exportName: candidate.exportName,
      };
    });

    return {
      id: task.id,
      name: task.name,
      title: task.title,
      enabled: task.enabled,
      languages,
      checks,
    };
  });

  return catalog;
}

export const LEVEL3_TASK_CATALOG: Level3TaskTemplate[] = validateLevel3TaskCatalog(
  RAW_LEVEL3_TASK_CATALOG,
);

export const LEVEL3_ENABLED_TASKS: Level3TaskTemplate[] = LEVEL3_TASK_CATALOG.filter(
  (task) => task.enabled,
);
