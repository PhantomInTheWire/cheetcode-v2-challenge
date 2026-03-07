import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getLevel3AutoSolveCode } from "../../server/level3/autoSolve";

function hasTool(tool: string): boolean {
  const check = spawnSync("sh", ["-lc", `command -v ${tool}`], { encoding: "utf8" });
  return check.status === 0;
}

const hasNativeToolchain = hasTool("clang") && hasTool("clang++") && hasTool("rustc");

function runCustomNativeHarness(language: "C" | "C++" | "Rust", code: string, harness: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3-native-regress-"));
  const ext = language === "C" ? "c" : language === "C++" ? "cpp" : "rs";
  fs.writeFileSync(path.join(dir, `main.${ext}`), code);
  fs.writeFileSync(path.join(dir, "harness.c"), harness);

  if (language === "C") {
    const compile = spawnSync("clang", ["main.c", "harness.c", "-o", "harness"], {
      cwd: dir,
      encoding: "utf8",
    });
    if (compile.status !== 0) return compile;
    return spawnSync("./harness", [], { cwd: dir, encoding: "utf8" });
  }

  if (language === "C++") {
    const harnessObj = spawnSync("clang", ["-c", "harness.c", "-o", "harness.o"], {
      cwd: dir,
      encoding: "utf8",
    });
    if (harnessObj.status !== 0) return harnessObj;
    const link = spawnSync("clang++", ["main.cpp", "harness.o", "-o", "harness"], {
      cwd: dir,
      encoding: "utf8",
    });
    if (link.status !== 0) return link;
    return spawnSync("./harness", [], { cwd: dir, encoding: "utf8" });
  }

  const rustLib = spawnSync("rustc", ["--crate-type", "staticlib", "main.rs", "-o", "libuser.a"], {
    cwd: dir,
    encoding: "utf8",
  });
  if (rustLib.status !== 0) return rustLib;
  const link = spawnSync(
    "clang",
    ["harness.c", "libuser.a", "-o", "harness", "-lpthread", "-ldl", "-lm"],
    { cwd: dir, encoding: "utf8" },
  );
  if (link.status !== 0) return link;
  return spawnSync("./harness", [], { cwd: dir, encoding: "utf8" });
}

describe.skipIf(!hasNativeToolchain)("level3 native regressions", () => {
  it("preserves version-0, bucket-boundary, count-dedup, and unknown-flag regressions for the flag rollout engine", () => {
    const languages = ["C", "C++", "Rust"] as const;
    const harness = `
#include <stdint.h>
#include <stdio.h>
#include <string.h>
typedef struct FlagEvalView {
  int exists;
  int environment_id;
  int decided_version;
  int matched_snapshot_id;
  int matched_rule_id;
  int decided_variant_id;
  int fallback_used;
  int tombstone_blocked;
  int stale_active_seen;
  int disabled_active_seen;
  int prerequisite_failed;
  int off_by_targeting;
  int usable;
} FlagEvalView;
void flag_reset(void);
int flag_define(int flag_id, int default_variant_id, int off_variant_id);
int flag_publish_snapshot(int snapshot_id, int flag_id, int environment_id,
                          int version, int rule_id, int segment_id,
                          int priority, int variant_id, int rollout_percent,
                          int track_events, int64_t not_before_ts,
                          int64_t expires_ts);
int flag_stage_version(int flag_id, int environment_id, int version);
int flag_activate_version(int flag_id, int environment_id);
int flag_set_fallback_version(int flag_id, int environment_id, int version);
int flag_evaluate(int flag_id, int environment_id, int subject_id,
                  int subject_bucket, int64_t ts);
int flag_explain_get(int flag_id, int environment_id, int subject_id,
                     int subject_bucket, int64_t ts, FlagEvalView *out_view);
int flag_count_usable_snapshots(int flag_id, int environment_id, int64_t ts);
int flag_last_error(void);
int main(void) {
  FlagEvalView view;
  memset(&view, 0, sizeof(view));

  flag_reset();
  flag_define(1, 101, 100);
  flag_publish_snapshot(1, 1, 1, 0, 1, 0, 5, 111, 100, 0, 0, 1000);
  if (!flag_stage_version(1, 1, 0)) return 10;
  if (!flag_activate_version(1, 1)) return 11;
  if (flag_evaluate(1, 1, 7, 10, 10) != 111) return 12;

  flag_reset();
  flag_define(2, 201, 200);
  flag_publish_snapshot(2, 2, 1, 1, 1, 0, 5, 210, 100, 0, 0, 1000);
  flag_stage_version(2, 1, 1);
  flag_activate_version(2, 1);
  if (flag_evaluate(2, 1, 7, -1, 10) != 201) return 20;
  if (flag_evaluate(2, 1, 7, 130, 10) != 201) return 21;

  flag_reset();
  flag_define(3, 301, 300);
  flag_publish_snapshot(30, 3, 1, 5, 1, 0, 4, 310, 100, 0, 0, 1000);
  flag_publish_snapshot(31, 3, 1, 5, 2, 0, 3, 311, 100, 0, 0, 1000);
  flag_stage_version(3, 1, 5);
  flag_activate_version(3, 1);
  flag_set_fallback_version(3, 1, 5);
  if (flag_count_usable_snapshots(3, 1, 10) != 2) return 30;

  flag_reset();
  if (flag_explain_get(999, 1, 1, 10, 10, &view) != 0) return 40;
  if (flag_last_error() != 4) return 41;
  return 0;
}
`;

    for (const language of languages) {
      const run = runCustomNativeHarness(
        language,
        getLevel3AutoSolveCode(language, "distributed-flag-snapshot-rollout-engine"),
        harness,
      );
      expect(run.status, `${language} stderr: ${run.stderr}\nstdout: ${run.stdout}`).toBe(0);
    }
  });

  it("preserves policy, session, trait, and fallback-validation regressions across native autosolvers", () => {
    const languages = ["C", "C++", "Rust"] as const;
    const cases = [
      {
        taskId: "versioned-policy-rollout-engine",
        harness: `
#include <stdint.h>
#include <string.h>
typedef struct PolicyExplainView {
  int exists;
  int matched_snapshot_id;
  int decided_version;
  int allow_mask;
  int deny_mask;
  int fallback_used;
  int stale_snapshot;
  int disabled_snapshot;
  int usable;
} PolicyExplainView;
void policy_reset(void);
int policy_publish_snapshot(int snapshot_id, int version, int subject_id,
                            int resource_id, int allow_mask, int deny_mask,
                            int priority, int64_t not_before_ts,
                            int64_t expires_ts);
int policy_set_subject_binding(int subject_id, int active_version, int fallback_version);
int policy_explain_get(int subject_id, int resource_id, int perm_bit, int64_t ts, PolicyExplainView* out_view);
int policy_count_subject_rules(int subject_id, int64_t ts);
int policy_last_error(void);
int main(void) {
  PolicyExplainView view;
  memset(&view, 0, sizeof(view));
  policy_reset();
  policy_publish_snapshot(1, 1, 7, 42, 1, 0, 1, 0, 100);
  policy_publish_snapshot(2, 2, 7, 42, 1, 0, 2, 0, 100);
  policy_set_subject_binding(7, 2, 1);
  if (policy_count_subject_rules(7, 10) != 2) return 10;
  policy_reset();
  policy_publish_snapshot(3, 1, 99, 42, 1, 0, 1, 0, 100);
  if (policy_explain_get(99, 42, 1, 10, &view) != 1) return 11;
  if (view.exists != 1) return 12;
  return 0;
}
`,
      },
      {
        taskId: "distributed-flag-snapshot-rollout-engine",
        harness: `
#include <stdint.h>
void flag_reset(void);
int flag_define(int flag_id, int default_variant_id, int off_variant_id);
int flag_publish_snapshot(int snapshot_id, int flag_id, int environment_id,
                          int version, int rule_id, int segment_id,
                          int priority, int variant_id, int rollout_percent,
                          int track_events, int64_t not_before_ts,
                          int64_t expires_ts);
int flag_stage_version(int flag_id, int environment_id, int version);
int flag_activate_version(int flag_id, int environment_id);
int flag_set_fallback_version(int flag_id, int environment_id, int version);
int flag_last_error(void);
int main(void) {
  flag_reset();
  flag_define(1, 101, 100);
  flag_publish_snapshot(1, 1, 1, 3, 1, 0, 1, 111, 100, 0, 0, 1000);
  flag_stage_version(1, 1, 3);
  flag_activate_version(1, 1);
  if (flag_set_fallback_version(1, 1, 999) != 0) return 20;
  if (flag_last_error() != 7) return 21;
  return 0;
}
`,
      },
      {
        taskId: "session-credential-rotation-compat-registry",
        harness: `
#include <stdint.h>
#include <string.h>
typedef struct SessionAuditView {
  int exists;
  int session_revoked;
  int active_generation;
  int staged_generation;
  int presented_generation;
  int grace_generation;
  int grace_active;
  int generation_revoked;
  int compatible;
  int usable;
} SessionAuditView;
void session_reset(void);
int session_create(int session_id, int subject_id, int resource_id, int active_generation);
int session_issue_credential(int credential_id, int session_id, int generation, int64_t issued_ts, int64_t expires_ts);
int session_revoke(int session_id, int generation);
int session_check(int session_id, int generation, int64_t ts);
int session_audit_get(int session_id, int generation, int64_t ts, SessionAuditView* out_view);
int session_last_error(void);
int main(void) {
  SessionAuditView view;
  memset(&view, 0, sizeof(view));
  session_reset();
  if (session_audit_get(999, 1, 10, &view) != 0) return 30;
  if (session_last_error() != 2) return 31;
  session_create(1, 7, 42, 1);
  for (int g = 1; g <= 9; g++) {
    session_issue_credential(100 + g, 1, g, 0, 1000);
    session_revoke(1, g);
  }
  if (session_check(1, 9, 10) != 0) return 32;
  return 0;
}
`,
      },
      {
        taskId: "trait-expression-ast",
        harness: `
#include <stdint.h>
#include <string.h>
typedef struct ExprAuditView {
  int exists;
  int kind;
  int string_evaluable;
  int match_evaluable;
  int constant_expr;
  int namespace_error;
  int matched;
  int output_string_id;
} ExprAuditView;
void expr_reset(void);
int expr_register_string(int string_id, const char* value);
int expr_register_var(int var_id, int namespace_kind, int string_id);
int expr_compile_var(int expr_id, int var_id);
int expr_compile_email_local(int expr_id, int child_expr_id);
int expr_audit_get(int expr_id, int matcher_string_id, ExprAuditView* out_view);
int main(void) {
  ExprAuditView view;
  memset(&view, 0, sizeof(view));
  expr_reset();
  expr_register_string(1, "bad@example.com");
  expr_register_var(2, 99, 1);
  expr_compile_var(10, 2);
  expr_compile_email_local(11, 10);
  if (expr_audit_get(11, 0, &view) != 1) return 40;
  if (view.namespace_error != 1) return 41;
  return 0;
}
`,
      },
    ] as const;

    for (const { taskId, harness } of cases) {
      for (const language of languages) {
        const run = runCustomNativeHarness(
          language,
          getLevel3AutoSolveCode(language, taskId),
          harness,
        );
        expect(
          run.status,
          `${taskId}/${language} stderr: ${run.stderr}\nstdout: ${run.stdout}`,
        ).toBe(0);
      }
    }
  });
});
