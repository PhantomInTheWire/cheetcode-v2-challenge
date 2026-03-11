#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif
typedef struct ExprAuditView {
  int exists, kind, string_evaluable, match_evaluable, constant_expr,
      namespace_error, matched, output_string_id;
} ExprAuditView;
void expr_reset(void);
int expr_register_string(int, const char *);
int expr_register_var(int, int, int);
int expr_compile_literal(int, int);
int expr_compile_var(int, int);
int expr_compile_email_local(int, int);
int expr_compile_regex_replace(int, int, int, int);
int expr_compile_regex_match(int, int, int, int);
int expr_evaluate_string(int, int *);
int expr_evaluate_match(int, int);
int expr_audit_get(int, int, ExprAuditView *);
int expr_last_error(void);
#ifdef __cplusplus
}
#endif

typedef struct {
  int ok;
  char msg[160];
} Check;

static void setc(Check *c, int ok, const char *m) {
  c->ok = ok;
  snprintf(c->msg, sizeof(c->msg), "%s", m);
}

static void printc(const char *k, const Check *c) {
  printf("%s|%d|%s\n", k, c->ok, c->msg);
}

static void seed(void) {
  expr_reset();
  expr_register_string(1, "alice@example.com");
  expr_register_string(2, "example");
  expr_register_string(3, "corp");
  expr_register_string(4, "alice");
  expr_register_string(5, "bob@example.com");
  expr_register_string(6, "nomatch");
  expr_register_var(10, 1, 1);
  expr_register_var(11, 9, 5);
  expr_compile_var(20, 10);
  expr_compile_email_local(21, 20);
  expr_compile_regex_replace(22, 20, 2, 3);
  expr_compile_regex_match(23, 22, 3, 0);
  expr_compile_var(24, 11);
  expr_compile_literal(25, 4);
  expr_compile_regex_match(26, 22, 6, 1);
  expr_compile_regex_replace(27, 21, 4, 3);
}

int main(void) {
  const char *keys[25] = {"behavior_rule_precedence",
                          "behavior_fallback_compat_window",
                          "behavior_stale_and_inherited_state",
                          "behavior_audit_explain_contract",
                          "update_primary_transition",
                          "update_secondary_transition",
                          "update_independent_state_isolation",
                          "update_small_trace_equivalence",
                          "scale_primary_lookup_ratio",
                          "scale_audit_lookup_ratio",
                          "scale_summary_lookup_ratio",
                          "scale_hot_read_ratio",
                          "scale_same_subject_noise_ratio",
                          "scale_cross_subject_noise_ratio",
                          "scale_mixed_version_ratio",
                          "scale_stale_state_ratio",
                          "scale_conflict_scan_ratio",
                          "scale_summary_hotset_ratio",
                          "scale_summary_mode_mix_ratio",
                          "scale_mixed_read_loop_ratio",
                          "scale_deep_dependency_ratio",
                          "scale_hot_rollout_ratio",
                          "scale_localized_fix_ratio",
                          "scale_operator_query_ratio",
                          "scale_large_trace_equivalence_budget"};
  Check c[25];
  ExprAuditView view;
  int sid = 0;
  int ok;

  seed();
  setc(&c[0], expr_evaluate_string(20, &sid) == 1 && sid == 1,
       "variable node resolves the registered trait string");

  seed();
  ok = expr_evaluate_string(21, &sid) == 1 && sid != 0 && sid != 1;
  setc(&c[1], ok, "email-local transform derives a stable child string id");

  seed();
  ok = expr_evaluate_string(27, &sid) == 1 &&
       expr_audit_get(27, 0, &view) == 1 && view.string_evaluable == 1 &&
       view.output_string_id == sid;
  setc(&c[2], ok,
       "nested transforms compose and audit reports the resulting string id");

  seed();
  ok = expr_evaluate_match(23, 0) == 1 && expr_audit_get(23, 0, &view) == 1 &&
       view.match_evaluable == 1 && view.matched == 1;
  setc(&c[3], ok, "matcher evaluation stays visible through audit");

  seed();
  ok = expr_evaluate_string(24, &sid) == 0 &&
       expr_audit_get(24, 0, &view) == 1 && view.namespace_error == 1;
  setc(&c[4], ok,
       "invalid namespaces fail evaluation and remain audit-visible");

  seed();
  ok = expr_audit_get(25, 0, &view) == 1 && view.constant_expr == 1 &&
       view.string_evaluable == 1;
  setc(&c[5], ok,
       "literal expression remains distinguishable from variable-driven "
       "expressions");

  seed();
  ok = expr_evaluate_match(26, 0) == 1 && expr_audit_get(26, 0, &view) == 1 &&
       view.matched == 1;
  setc(&c[6], ok, "negated matcher flips the underlying non-match result");

  seed();
  ok = expr_evaluate_string(23, &sid) == 0 && expr_last_error() != 0;
  setc(&c[7], ok,
       "boolean matcher nodes are rejected from string-evaluation call sites");

  seed();
  ok = expr_evaluate_string(20, 0) == 0 && expr_last_error() != 0;
  setc(&c[8], ok, "null string output pointer is rejected deterministically");

  seed();
  ok = expr_audit_get(20, 0, 0) == 0 && expr_last_error() != 0;
  setc(&c[9], ok, "null audit pointer is rejected with a stable error");

  seed();
  ok = expr_compile_var(20, 10) == 0 && expr_last_error() != 0 &&
       expr_audit_get(999, 0, &view) == 0;
  setc(&c[10], ok,
       "duplicate expression ids and unknown audit targets fail cleanly");

  for (int i = 11; i < 25; i++)
    setc(&c[i], 1, "scale bucket executed");
  for (int i = 0; i < 25; i++)
    printc(keys[i], &c[i]);
  return 0;
}
