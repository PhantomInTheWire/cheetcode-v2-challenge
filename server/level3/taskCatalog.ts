import { LEVEL3_TOTAL } from "../../src/lib/config/constants";

export const LEVEL3_SUPPORTED_LANGUAGES = ["C", "C++", "Rust"] as const;

export type Level3SupportedLanguage = (typeof LEVEL3_SUPPORTED_LANGUAGES)[number];

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
  originTags?: string[];
  checks: Level3TaskCheckTemplate[];
};

function createMaintainerBucketChecks(names: {
  behaviorRead: string;
  behaviorAudit: string;
  updatePrimary: string;
  updateSecondary: string;
  scaleRead: string;
  scaleAudit: string;
  scaleSummary: string;
}): Level3TaskCheckTemplate[] {
  return [
    { key: "behavior_rule_precedence", name: "Behavior Bucket 1", exportName: names.behaviorRead },
    {
      key: "behavior_fallback_compat_window",
      name: "Behavior Bucket 2",
      exportName: names.behaviorRead,
    },
    {
      key: "behavior_stale_and_inherited_state",
      name: "Behavior Bucket 3",
      exportName: names.behaviorRead,
    },
    {
      key: "behavior_audit_explain_contract",
      name: "Behavior Bucket 4",
      exportName: names.behaviorAudit,
    },
    { key: "update_primary_transition", name: "Update Bucket 1", exportName: names.updatePrimary },
    {
      key: "update_secondary_transition",
      name: "Update Bucket 2",
      exportName: names.updateSecondary,
    },
    {
      key: "update_independent_state_isolation",
      name: "Update Bucket 3",
      exportName: names.updatePrimary,
    },
    {
      key: "update_small_trace_equivalence",
      name: "Update Bucket 4",
      exportName: names.behaviorRead,
    },
    { key: "scale_primary_lookup_ratio", name: "Scale Budget 1", exportName: names.scaleRead },
    { key: "scale_audit_lookup_ratio", name: "Scale Budget 2", exportName: names.scaleAudit },
    { key: "scale_summary_lookup_ratio", name: "Scale Budget 3", exportName: names.scaleSummary },
    { key: "scale_hot_read_ratio", name: "Scale Budget 4", exportName: names.scaleRead },
    { key: "scale_same_subject_noise_ratio", name: "Scale Budget 5", exportName: names.scaleRead },
    { key: "scale_cross_subject_noise_ratio", name: "Scale Budget 6", exportName: names.scaleRead },
    { key: "scale_mixed_version_ratio", name: "Scale Budget 7", exportName: names.scaleRead },
    { key: "scale_stale_state_ratio", name: "Scale Budget 8", exportName: names.scaleRead },
    { key: "scale_conflict_scan_ratio", name: "Scale Budget 9", exportName: names.scaleRead },
    { key: "scale_summary_hotset_ratio", name: "Scale Budget 10", exportName: names.scaleSummary },
    {
      key: "scale_summary_mode_mix_ratio",
      name: "Scale Budget 11",
      exportName: names.scaleSummary,
    },
    { key: "scale_mixed_read_loop_ratio", name: "Scale Budget 12", exportName: names.scaleRead },
    { key: "scale_deep_dependency_ratio", name: "Scale Budget 13", exportName: names.scaleRead },
    { key: "scale_hot_rollout_ratio", name: "Scale Budget 14", exportName: names.scaleRead },
    { key: "scale_localized_fix_ratio", name: "Scale Budget 15", exportName: names.scaleRead },
    { key: "scale_operator_query_ratio", name: "Scale Budget 16", exportName: names.scaleAudit },
    {
      key: "scale_large_trace_equivalence_budget",
      name: "Scale Budget 17",
      exportName: names.scaleRead,
    },
  ];
}

const RAW_LEVEL3_TASK_CATALOG: Level3TaskTemplate[] = [
  {
    id: "cpu-16bit-emulator",
    name: "16-bit CPU Emulator",
    title: "Level 3 Systems Spec",
    enabled: true,
    languages: ["C", "C++", "Rust"],
    originTags: ["back_end_knowledge", "performance_knowledge", "core_feat"],
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
      {
        key: "logic_bitwise",
        name: "Bitwise + shift scalar semantics",
        exportName: "cpu_get_reg",
      },
      { key: "branch_jnz_loop", name: "JNZ/JN branch control flow", exportName: "cpu_get_pc" },
      { key: "stack_push_pop", name: "Stack push/pop behavior", exportName: "cpu_get_sp" },
      { key: "stack_call_ret", name: "CALL/RET discipline", exportName: "cpu_get_sp" },
      {
        key: "memory_wraparound",
        name: "Core wraparound + unaligned semantics",
        exportName: "cpu_mem_read16",
      },
      {
        key: "helper_load_word_bounds",
        name: "Helper load-word + mem-read bounds",
        exportName: "cpu_load_word",
      },
      { key: "simd_lane_add_wrap", name: "SIMD VADD lane wraparound", exportName: "cpu_get_reg" },
      { key: "simd_lane_sub_wrap", name: "SIMD VSUB lane wraparound", exportName: "cpu_get_reg" },
      {
        key: "simd_lane_xor_flag_stability",
        name: "SIMD VXOR and flag stability",
        exportName: "cpu_get_flag_v",
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
      {
        key: "random_alu_cmp",
        name: "Randomized ALU + CMP flag property checks",
        exportName: "cpu_get_reg",
      },
      { key: "benchmark_budget", name: "Cycle/timing budget constraints", exportName: "cpu_run" },
      { key: "perf_run_throughput", name: "Run throughput benchmark", exportName: "cpu_run" },
      { key: "perf_simd_throughput", name: "SIMD throughput benchmark", exportName: "cpu_run" },
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
  {
    id: "identity-bundle-auth-resolver",
    name: "Identity Bundle Auth Resolver",
    title: "Level 3 Systems Spec",
    enabled: true,
    languages: ["C", "C++", "Rust"],
    originTags: [
      "authentication_authorization_knowledge",
      "security_knowledge",
      "major_bug",
      "integration_bug",
      "edge_case_bug",
      "data_bug",
    ],
    checks: [
      {
        key: "behavior_source_resolution",
        name: "Behavior Bucket 1",
        exportName: "auth_check",
      },
      {
        key: "behavior_time_and_perm_contract",
        name: "Behavior Bucket 2",
        exportName: "auth_check",
      },
      {
        key: "behavior_delegation_and_ancestors",
        name: "Behavior Bucket 3",
        exportName: "auth_check",
      },
      {
        key: "behavior_audit_count_error_contract",
        name: "Behavior Bucket 4",
        exportName: "auth_audit_get",
      },
      {
        key: "update_revoke_read_consistency",
        name: "Update Bucket 1",
        exportName: "auth_revoke",
      },
      {
        key: "update_key_attach_read_consistency",
        name: "Update Bucket 2",
        exportName: "auth_attach_bundle_key",
      },
      {
        key: "update_independent_chain_isolation",
        name: "Update Bucket 3",
        exportName: "auth_revoke",
      },
      {
        key: "update_small_trace_equivalence",
        name: "Update Bucket 4",
        exportName: "auth_check",
      },
      {
        key: "scale_grant_id_lookup_ratio",
        name: "Scale Budget 1",
        exportName: "auth_effective_mask",
      },
      {
        key: "scale_audit_lookup_ratio",
        name: "Scale Budget 2",
        exportName: "auth_audit_get",
      },
      {
        key: "scale_effective_mask_lookup_ratio",
        name: "Scale Budget 3",
        exportName: "auth_effective_mask",
      },
      {
        key: "scale_auto_bundle_presence_other_subject_noise",
        name: "Scale Budget 4",
        exportName: "auth_check",
      },
      {
        key: "scale_auto_bundle_presence_same_subject_noise",
        name: "Scale Budget 5",
        exportName: "auth_check",
      },
      {
        key: "scale_hot_auth_lookup_ratio",
        name: "Scale Budget 6",
        exportName: "auth_check",
      },
      {
        key: "scale_same_subject_irrelevant_resource_ratio",
        name: "Scale Budget 7",
        exportName: "auth_check",
      },
      {
        key: "scale_other_subject_noise_ratio",
        name: "Scale Budget 8",
        exportName: "auth_check",
      },
      {
        key: "scale_count_usable_hot_subject_ratio",
        name: "Scale Budget 9",
        exportName: "auth_count_usable",
      },
      {
        key: "scale_count_usable_mode_mix_ratio",
        name: "Scale Budget 10",
        exportName: "auth_count_usable",
      },
      {
        key: "scale_mixed_read_loop_ratio",
        name: "Scale Budget 11",
        exportName: "auth_check",
      },
      {
        key: "scale_deep_chain_hot_read_ratio",
        name: "Scale Budget 12",
        exportName: "auth_check",
      },
      {
        key: "scale_bundle_heavy_hotset_ratio",
        name: "Scale Budget 13",
        exportName: "auth_check",
      },
      {
        key: "scale_local_heavy_hotset_ratio",
        name: "Scale Budget 14",
        exportName: "auth_check",
      },
      {
        key: "scale_mixed_source_hotset_ratio",
        name: "Scale Budget 15",
        exportName: "auth_check",
      },
      {
        key: "scale_large_read_budget",
        name: "Scale Budget 16",
        exportName: "auth_check",
      },
      {
        key: "scale_large_trace_equivalence_budget",
        name: "Scale Budget 17",
        exportName: "auth_check",
      },
    ],
  },
  {
    id: "trait-expression-ast",
    name: "Trait Expression AST",
    title: "Level 3 Systems Spec",
    enabled: true,
    languages: ["C", "C++", "Rust"],
    originTags: [
      "security_knowledge",
      "back_end_knowledge",
      "authentication_authorization_knowledge",
      "api_knowledge",
      "integration_bug",
      "data_bug",
      "compatibility_bug",
    ],
    checks: createMaintainerBucketChecks({
      behaviorRead: "expr_evaluate_match",
      behaviorAudit: "expr_audit_get",
      updatePrimary: "expr_compile_regex_replace",
      updateSecondary: "expr_compile_var",
      scaleRead: "expr_evaluate_match",
      scaleAudit: "expr_audit_get",
      scaleSummary: "expr_evaluate_string",
    }),
  },
  {
    id: "distributed-flag-snapshot-rollout-engine",
    name: "Distributed Flag Snapshot Rollout Engine",
    title: "Level 3 Systems Spec",
    enabled: true,
    languages: ["C", "C++", "Rust"],
    originTags: [
      "back_end_knowledge",
      "api_knowledge",
      "infrastructure_knowledge",
      "devops_knowledge",
      "cloud_knowledge",
      "integration_bug",
      "major_bug",
      "data_bug",
      "scalability_enh",
    ],
    checks: createMaintainerBucketChecks({
      behaviorRead: "flag_evaluate",
      behaviorAudit: "flag_explain_get",
      updatePrimary: "flag_activate_version",
      updateSecondary: "flag_mark_replica_stale",
      scaleRead: "flag_evaluate",
      scaleAudit: "flag_explain_get",
      scaleSummary: "flag_count_usable_snapshots",
    }),
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
    assertNonEmptyString(
      task.id,
      `Invalid level3 task at index ${taskIndex}: id must be non-empty string`,
    );
    const taskId = task.id;

    if (seenTaskIds.has(taskId)) {
      throw new Error(`Invalid level3 task catalog: duplicate task id '${taskId}'`);
    }
    seenTaskIds.add(taskId);

    assertNonEmptyString(
      task.name,
      `Invalid level3 task '${taskId}': name must be non-empty string`,
    );
    const taskName = task.name;

    if (
      task.title !== undefined &&
      (typeof task.title !== "string" || task.title.trim().length === 0)
    ) {
      throw new Error(
        `Invalid level3 task '${taskId}': title must be a non-empty string when provided`,
      );
    }

    if (typeof task.enabled !== "boolean") {
      throw new Error(`Invalid level3 task '${taskId}': enabled must be boolean`);
    }
    const taskEnabled = task.enabled;

    if (!Array.isArray(task.languages) || task.languages.length === 0) {
      throw new Error(`Invalid level3 task '${taskId}': languages must be a non-empty array`);
    }
    const taskLanguages = task.languages;

    const seenLanguages = new Set<string>();
    const languages = taskLanguages.map((language) => {
      assertSupportedLanguage(language, taskId);
      if (seenLanguages.has(language)) {
        throw new Error(`Invalid level3 task '${taskId}': duplicate language '${language}'`);
      }
      seenLanguages.add(language);
      return language;
    });

    if (task.originTags !== undefined) {
      if (!Array.isArray(task.originTags)) {
        throw new Error(`Invalid level3 task '${taskId}': originTags must be an array`);
      }
      const seenOriginTags = new Set<string>();
      for (const tag of task.originTags) {
        assertNonEmptyString(
          tag,
          `Invalid level3 task '${taskId}': originTags entries must be non-empty strings`,
        );
        if (seenOriginTags.has(tag)) {
          throw new Error(`Invalid level3 task '${taskId}': duplicate origin tag '${tag}'`);
        }
        seenOriginTags.add(tag);
      }
    }

    if (!Array.isArray(task.checks) || task.checks.length === 0) {
      throw new Error(`Invalid level3 task '${taskId}': checks must be a non-empty array`);
    }
    const taskChecks = task.checks;

    if (taskEnabled && taskChecks.length !== LEVEL3_TOTAL) {
      throw new Error(
        `Invalid level3 task '${taskId}': enabled tasks must define exactly ${LEVEL3_TOTAL} checks`,
      );
    }

    const seenCheckKeys = new Set<string>();
    const checks = taskChecks.map((check, checkIndex) => {
      if (!check || typeof check !== "object") {
        throw new Error(
          `Invalid level3 task '${taskId}' check at index ${checkIndex}: expected object`,
        );
      }
      const candidate = check as Partial<Level3TaskCheckTemplate>;
      assertNonEmptyString(
        candidate.key,
        `Invalid level3 task '${taskId}' check at index ${checkIndex}: key must be non-empty string`,
      );
      assertNonEmptyString(
        candidate.name,
        `Invalid level3 task '${taskId}' check '${candidate.key}': name must be non-empty string`,
      );
      assertNonEmptyString(
        candidate.exportName,
        `Invalid level3 task '${taskId}' check '${candidate.key}': exportName must be non-empty string`,
      );
      if (seenCheckKeys.has(candidate.key)) {
        throw new Error(`Invalid level3 task '${taskId}': duplicate check key '${candidate.key}'`);
      }
      seenCheckKeys.add(candidate.key);
      return {
        key: candidate.key,
        name: candidate.name,
        exportName: candidate.exportName,
      };
    });

    return {
      id: taskId,
      name: taskName,
      title: task.title,
      enabled: taskEnabled,
      languages,
      originTags: task.originTags ? [...task.originTags] : undefined,
      checks,
    };
  });

  return catalog;
}

export const LEVEL3_TASK_CATALOG: Level3TaskTemplate[] =
  validateLevel3TaskCatalog(RAW_LEVEL3_TASK_CATALOG);

export const LEVEL3_ENABLED_TASKS: Level3TaskTemplate[] = LEVEL3_TASK_CATALOG.filter(
  (task) => task.enabled,
);
