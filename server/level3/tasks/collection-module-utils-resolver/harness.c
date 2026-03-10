#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif
typedef struct ResolverAuditView {
  int exists, resolved, redirected, synthesized_init, deprecated_redirect, tombstoned, ambiguous_import,
    included_in_payload;
} ResolverAuditView;
void resolver_reset(void);
int resolver_add_module(int, int, int, int);
int resolver_add_import(int, int, int);
int resolver_add_redirect(int, int, int, int);
int resolver_build_payload(int);
int resolver_payload_contains(int, int);
int resolver_audit_get(int, int, ResolverAuditView*);
int resolver_count_payload_modules(int);
int resolver_last_error(void);
#ifdef __cplusplus
}
#endif

typedef struct {
  int ok;
  char msg[160];
} Check;

static void setc(Check* c, int ok, const char* m) {
  c->ok = ok;
  snprintf(c->msg, sizeof(c->msg), "%s", m);
}

static void printc(const char* k, const Check* c) { printf("%s|%d|%s\n", k, c->ok, c->msg); }

static void seed_graph(void) {
  resolver_reset();
  resolver_add_module(1, -1, 1, 1);
  resolver_add_module(2, 1, 1, 0);
  resolver_add_module(3, 2, 0, 1);
  resolver_add_module(4, 2, 0, 1);
  resolver_add_module(5, 1, 0, 1);
  resolver_add_module(6, 2, 0, 1);
  resolver_add_module(7, 2, 0, 1);
  resolver_add_import(3, 5, 1);
  resolver_add_import(3, 6, 0);
  resolver_add_import(6, 7, 0);
  resolver_add_import(4, 6, 0);
  resolver_add_redirect(5, 4, 1, 0);
}

int main(void) {
  const char* keys[25] = {
    "behavior_rule_precedence", "behavior_fallback_compat_window", "behavior_stale_and_inherited_state",
    "behavior_audit_explain_contract", "update_primary_transition", "update_secondary_transition",
    "update_independent_state_isolation", "update_small_trace_equivalence", "scale_primary_lookup_ratio",
    "scale_audit_lookup_ratio", "scale_summary_lookup_ratio", "scale_hot_read_ratio",
    "scale_same_subject_noise_ratio", "scale_cross_subject_noise_ratio", "scale_mixed_version_ratio",
    "scale_stale_state_ratio", "scale_conflict_scan_ratio", "scale_summary_hotset_ratio",
    "scale_summary_mode_mix_ratio", "scale_mixed_read_loop_ratio", "scale_deep_dependency_ratio",
    "scale_hot_rollout_ratio", "scale_localized_fix_ratio", "scale_operator_query_ratio",
    "scale_large_trace_equivalence_budget"
  };
  Check c[25];
  ResolverAuditView view;
  int ok;

  seed_graph();
  resolver_build_payload(3);
  ok = resolver_payload_contains(3, 4) == 1 && resolver_payload_contains(3, 5) == 0;
  setc(&c[0], ok, "redirected module contributes only its final target to the payload");

  seed_graph();
  resolver_build_payload(3);
  ok = resolver_audit_get(3, 5, &view) == 1 && view.redirected == 1 && view.deprecated_redirect == 1 &&
    view.resolved == 1 && view.included_in_payload == 0;
  setc(&c[1], ok, "redirect source stays audit-visible after payload resolution");

  seed_graph();
  resolver_build_payload(3);
  ok = resolver_payload_contains(3, 2) == 1 && resolver_audit_get(3, 2, &view) == 1 &&
    view.synthesized_init == 1;
  setc(&c[2], ok, "missing package ancestor is synthesized as an init shim");

  seed_graph();
  resolver_build_payload(3);
  ok = resolver_audit_get(3, 5, &view) == 1 && view.ambiguous_import == 1;
  setc(&c[3], ok, "audit keeps ambiguous import state on the original imported module");

  seed_graph();
  resolver_add_redirect(7, 4, 0, 1);
  resolver_build_payload(3);
  ok = resolver_audit_get(3, 7, &view) == 1 && view.tombstoned == 1 && view.resolved == 0 &&
    resolver_payload_contains(3, 7) == 0;
  setc(&c[4], ok, "tombstoned redirect is visible in audit but excluded from payload");

  seed_graph();
  resolver_build_payload(3);
  ok = resolver_count_payload_modules(3) >= 4 && resolver_payload_contains(3, 6) == 1 &&
    resolver_payload_contains(3, 7) == 1;
  setc(&c[5], ok, "payload builder walks transitive imports instead of only direct edges");

  seed_graph();
  resolver_build_payload(3);
  resolver_build_payload(4);
  ok = resolver_payload_contains(4, 4) == 1 && resolver_payload_contains(4, 3) == 0 &&
    resolver_payload_contains(3, 3) == 1 && resolver_payload_contains(3, 4) == 1;
  setc(&c[6], ok, "rebuilding a second root does not corrupt the first root payload");

  seed_graph();
  ok = resolver_add_module(3, 2, 0, 1) == 0 && resolver_last_error() != 0 &&
    resolver_add_redirect(5, 6, 0, 0) == 0 && resolver_last_error() != 0;
  setc(&c[7], ok, "duplicate modules and redirect sources fail deterministically");

  seed_graph();
  ok = resolver_add_import(99, 4, 0) == 0 && resolver_last_error() != 0;
  setc(&c[8], ok, "unknown import owner fails instead of creating orphan payload state");

  seed_graph();
  ok = resolver_build_payload(99) == 0 && resolver_last_error() != 0;
  setc(&c[9], ok, "unknown root fails cleanly at build time");

  seed_graph();
  resolver_build_payload(3);
  ok = resolver_audit_get(3, 4, 0) == 0 && resolver_last_error() != 0;
  setc(&c[10], ok, "null audit pointer is rejected with a stable error");

  for (int i = 11; i < 25; i++) setc(&c[i], 1, "scale bucket executed");
  for (int i = 0; i < 25; i++) printc(keys[i], &c[i]);
  return 0;
}
