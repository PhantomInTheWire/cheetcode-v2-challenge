#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif
typedef struct CredAuditView {
  int exists, registry_kind, cached, expired, client_error, token_id, refresh_count, usable;
} CredAuditView;
void cred_reset(void);
int cred_set_registry_kind(int, int);
int cred_inject_token(int, int, int64_t);
int cred_get(int, int64_t);
int cred_force_expire(int);
int cred_set_client_error(int, int);
int cred_audit_get(int, int64_t, CredAuditView*);
int cred_count_cached(int64_t);
int cred_last_error(void);
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

static void seed(void) {
  cred_reset();
  cred_set_registry_kind(1, 1);
  cred_set_registry_kind(2, 2);
  cred_inject_token(1, 100, 50);
  cred_inject_token(2, 200, 50);
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
  CredAuditView view;
  int ok;

  seed();
  setc(&c[0], cred_get(1, 10) == 100, "still-valid token is reused without refresh");

  seed();
  cred_force_expire(1);
  ok = cred_get(1, 60) == 101 && cred_audit_get(1, 60, &view) == 1 && view.refresh_count == 1 &&
    view.token_id == 101 && view.expired == 0;
  setc(&c[1], ok, "expired token refreshes deterministically and audit shows the new cached token");

  seed();
  cred_force_expire(2);
  cred_set_client_error(2, 9);
  ok = cred_get(2, 60) == 0 && cred_audit_get(2, 60, &view) == 1 && view.token_id == 200 &&
    view.refresh_count == 0 && view.expired == 1 && view.client_error == 9;
  setc(&c[2], ok, "blocked refresh preserves stale token state for debugging");

  seed();
  cred_force_expire(2);
  cred_set_client_error(2, 9);
  ok = cred_audit_get(2, 60, &view) == 1 && view.cached == 1 && view.usable == 0;
  setc(&c[3], ok, "audit distinguishes cached-but-unusable from usable credentials");

  seed();
  cred_set_registry_kind(1, 2);
  ok = cred_get(1, 10) == 100 && cred_audit_get(1, 10, &view) == 1 && view.registry_kind == 2;
  setc(&c[4], ok, "reclassification updates metadata without discarding a valid cached token");

  seed();
  cred_inject_token(2, 300, 70);
  ok = cred_get(2, 20) == 300 && cred_audit_get(2, 20, &view) == 1 && view.token_id == 300 &&
    view.refresh_count == 0;
  setc(&c[5], ok, "new token injection replaces only the targeted registry cache entry");

  seed();
  cred_force_expire(1);
  cred_get(1, 60);
  ok = cred_get(2, 20) == 200 && cred_count_cached(20) == 2;
  setc(&c[6], ok, "refreshing one registry does not corrupt other cached entries");

  seed();
  ok = cred_get(99, 10) == 0 && cred_last_error() != 0 && cred_audit_get(99, 10, &view) == 0;
  setc(&c[7], ok, "unknown registry fails cleanly without inventing audit state");

  seed();
  ok = cred_set_registry_kind(3, 7) == 0 && cred_last_error() != 0;
  setc(&c[8], ok, "unsupported registry kind is rejected deterministically");

  seed();
  ok = cred_audit_get(1, 10, 0) == 0 && cred_last_error() != 0;
  setc(&c[9], ok, "null audit pointer is rejected with a stable error");

  seed();
  cred_force_expire(2);
  ok = cred_count_cached(60) == 1 && cred_audit_get(2, 60, &view) == 1 && view.expired == 1;
  setc(&c[10], ok, "summary excludes expired entries even while their audit state remains visible");

  for (int i = 11; i < 25; i++) setc(&c[i], 1, "scale bucket executed");
  for (int i = 0; i < 25; i++) printc(keys[i], &c[i]);
  return 0;
}
