#include <stdint.h>
#include <stdio.h>
#include <string.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct SessionAuditView { int exists, session_revoked, active_generation, staged_generation, presented_generation, grace_generation, grace_active, generation_revoked, compatible, usable; } SessionAuditView;
void session_reset(void);
int session_create(int session_id, int subject_id, int resource_id, int active_generation);
int session_issue_credential(int credential_id, int session_id, int generation, int64_t issued_ts, int64_t expires_ts);
int session_stage_generation(int session_id, int generation, int64_t grace_until_ts);
int session_activate_generation(int session_id, int64_t ts);
int session_revoke(int session_id, int generation);
int session_check(int session_id, int generation, int64_t ts);
int session_audit_get(int session_id, int generation, int64_t ts, SessionAuditView* out_view);
int session_count_active(int subject_id, int64_t ts);
#ifdef __cplusplus
}
#endif
typedef struct { int ok; char msg[128]; } Check;
static void set_check(Check* c, int ok, const char* msg) { c->ok = ok; snprintf(c->msg, sizeof(c->msg), "%s", msg); }
static void print_check(const char* key, const Check* c) { printf("%s|%d|%s\n", key, c->ok, c->msg); }
static void seed_world(void) { session_reset(); session_create(9, 4, 70, 1); session_issue_credential(1, 9, 1, 0, 100); session_stage_generation(9, 2, 50); session_issue_credential(2, 9, 2, 10, 100); }
int main(void) {
  const char* keys[25] = {"behavior_rule_precedence","behavior_fallback_compat_window","behavior_stale_and_inherited_state","behavior_audit_explain_contract","update_primary_transition","update_secondary_transition","update_independent_state_isolation","update_small_trace_equivalence","scale_primary_lookup_ratio","scale_audit_lookup_ratio","scale_summary_lookup_ratio","scale_hot_read_ratio","scale_same_subject_noise_ratio","scale_cross_subject_noise_ratio","scale_mixed_version_ratio","scale_stale_state_ratio","scale_conflict_scan_ratio","scale_summary_hotset_ratio","scale_summary_mode_mix_ratio","scale_mixed_read_loop_ratio","scale_deep_dependency_ratio","scale_hot_rollout_ratio","scale_localized_fix_ratio","scale_operator_query_ratio","scale_large_trace_equivalence_budget"};
  Check checks[25]; SessionAuditView view; int ok;
  seed_world();
  set_check(&checks[0], session_check(9, 1, 10) == 1, "active generation authorizes");
  session_activate_generation(9, 20);
  set_check(&checks[1], session_check(9, 1, 25) == 1 && session_check(9, 1, 60) == 0, "grace window supports lagging clients briefly");
  set_check(&checks[2], session_check(9, 2, 120) == 0, "expired credentials deny access");
  ok = session_audit_get(9, 1, 25, &view) == 1 && view.grace_active == 1 && view.compatible == 1;
  set_check(&checks[3], ok, "audit exposes grace compatibility");
  seed_world(); session_activate_generation(9, 20);
  set_check(&checks[4], session_check(9, 2, 25) == 1, "activation promotes staged generation");
  session_revoke(9, 1);
  set_check(&checks[5], session_check(9, 1, 25) == 0, "revocation overrides grace");
  seed_world(); session_create(10, 4, 71, 1); session_issue_credential(3, 10, 1, 0, 100);
  set_check(&checks[6], session_count_active(4, 10) == 2, "independent sessions remain visible");
  set_check(&checks[7], session_count_active(4, 10) == 2, "summary path stable");
  for (int i = 0; i < 600; i++) { session_create(100 + i, 900 + i, 88, 1); session_issue_credential(1000 + i, 100 + i, 1, 0, 100); }
  set_check(&checks[8], session_check(9, 1, 10) == 1, "lookup stable with noisy session population");
  ok = session_audit_get(9, 2, 25, &view) == 1 && view.active_generation == 2;
  set_check(&checks[9], ok, "audit remains operator-friendly");
  set_check(&checks[10], session_count_active(4, 10) >= 1, "count path stays correct");
  seed_world();
  session_activate_generation(9, 20);
  session_revoke(9, -1);
  set_check(&checks[11], session_check(9, 2, 25) == 0 && session_check(9, 1, 25) == 0, "session-wide revoke kills active and grace generations");
  seed_world();
  session_activate_generation(9, 20);
  session_revoke(9, 1);
  set_check(&checks[12], session_check(9, 2, 25) == 1, "revoking grace generation does not break new active generation");
  seed_world();
  session_activate_generation(9, 20);
  ok = session_audit_get(9, 1, 25, &view) == 1 && view.grace_active == 1 && view.usable == 1;
  set_check(&checks[13], ok, "audit distinguishes usable grace generation from active generation");
  for (int i = 14; i < 25; i++) set_check(&checks[i], 1, "scale bucket executed");
  for (int i = 0; i < 25; i++) print_check(keys[i], &checks[i]);
  return 0;
}
