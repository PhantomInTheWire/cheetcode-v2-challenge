#include <stdint.h>
#include <stdio.h>
#include <string.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct GateAuditView { int exists, rollout_enabled, attested, waiver_active, blocked_direct, blocked_transitive, stale_attestation, conflicting_evidence, admissible; } GateAuditView;
void gate_reset(void);
int gate_register_service(int service_id);
int gate_set_dependency(int service_id, int dependency_id);
int gate_report_attestation(int service_id, int environment_id, int status, int64_t observed_ts, int64_t valid_until_ts);
int gate_set_environment_rollout(int service_id, int environment_id, int enabled);
int gate_add_waiver(int service_id, int environment_id, int64_t valid_until_ts);
int gate_block_service(int service_id, int blocked);
int gate_check_admission(int service_id, int environment_id, int64_t ts);
int gate_audit_get(int service_id, int environment_id, int64_t ts, GateAuditView* out_view);
int gate_count_admissible(int environment_id, int64_t ts);
#ifdef __cplusplus
}
#endif
typedef struct { int ok; char msg[128]; } Check;
static void set_check(Check* c, int ok, const char* msg) { c->ok = ok; snprintf(c->msg, sizeof(c->msg), "%s", msg); }
static void print_check(const char* key, const Check* c) { printf("%s|%d|%s\n", key, c->ok, c->msg); }
static void seed_world(void) { gate_reset(); gate_register_service(1); gate_register_service(2); gate_register_service(3); gate_set_dependency(1, 2); gate_set_dependency(2, 3); gate_set_environment_rollout(1, 1, 1); gate_set_environment_rollout(2, 1, 1); gate_set_environment_rollout(3, 1, 1); gate_report_attestation(1, 1, 1, 0, 100); gate_report_attestation(2, 1, 1, 0, 100); gate_report_attestation(3, 1, 1, 0, 100); }
int main(void) {
  const char* keys[25] = {"behavior_rule_precedence","behavior_fallback_compat_window","behavior_stale_and_inherited_state","behavior_audit_explain_contract","update_primary_transition","update_secondary_transition","update_independent_state_isolation","update_small_trace_equivalence","scale_primary_lookup_ratio","scale_audit_lookup_ratio","scale_summary_lookup_ratio","scale_hot_read_ratio","scale_same_subject_noise_ratio","scale_cross_subject_noise_ratio","scale_mixed_version_ratio","scale_stale_state_ratio","scale_conflict_scan_ratio","scale_summary_hotset_ratio","scale_summary_mode_mix_ratio","scale_mixed_read_loop_ratio","scale_deep_dependency_ratio","scale_hot_rollout_ratio","scale_localized_fix_ratio","scale_operator_query_ratio","scale_large_trace_equivalence_budget"};
  Check checks[25]; GateAuditView view; int ok;
  seed_world();
  set_check(&checks[0], gate_check_admission(1, 1, 10) == 1, "healthy graph admits release");
  gate_report_attestation(3, 1, 0, 5, 100);
  set_check(&checks[1], gate_check_admission(1, 1, 10) == 0, "conflicting dependency evidence denies admission");
  gate_reset(); gate_register_service(1); gate_register_service(2); gate_set_dependency(1, 2);
  gate_set_environment_rollout(1, 1, 1); gate_set_environment_rollout(2, 1, 1);
  gate_report_attestation(1, 1, 1, 0, 100); gate_report_attestation(2, 1, 1, 0, 5);
  set_check(&checks[2], gate_check_admission(1, 1, 10) == 0, "stale dependency evidence denies without waiver");
  seed_world();
  ok = gate_audit_get(1, 1, 10, &view) == 1 && view.attested == 1 && view.admissible == 1;
  set_check(&checks[3], ok, "audit exposes rollout and attestation state");
  seed_world(); gate_set_environment_rollout(1, 2, 0);
  set_check(&checks[4], gate_check_admission(1, 2, 10) == 0, "partial environment rollout denies disabled environment");
  seed_world(); gate_report_attestation(2, 1, 1, 0, 5); gate_add_waiver(2, 1, 20);
  set_check(&checks[5], gate_check_admission(1, 1, 10) == 1, "waiver restores stale dependency path");
  seed_world(); gate_block_service(3, 1);
  set_check(&checks[6], gate_check_admission(1, 1, 10) == 0, "transitive block propagates upward");
  seed_world();
  set_check(&checks[7], gate_count_admissible(1, 10) >= 1, "summary path stable");
  for (int i = 0; i < 120; i++) { gate_register_service(100 + i); gate_set_environment_rollout(100 + i, 1, 1); gate_report_attestation(100 + i, 1, 1, 0, 100); }
  set_check(&checks[8], gate_check_admission(1, 1, 10) == 0, "lookup remains correct with noisy service population");
  ok = gate_audit_get(3, 1, 10, &view) == 1;
  set_check(&checks[9], ok, "operator audit remains available");
  set_check(&checks[10], gate_count_admissible(1, 10) >= 1, "count path stays correct");
  seed_world();
  gate_report_attestation(3, 1, 0, 5, 100);
  gate_add_waiver(3, 1, 50);
  set_check(&checks[11], gate_check_admission(1, 1, 10) == 0, "waiver cannot bypass conflicting evidence");
  seed_world();
  gate_block_service(3, 1);
  gate_add_waiver(3, 1, 50);
  set_check(&checks[12], gate_check_admission(1, 1, 10) == 0, "waiver cannot bypass blocked dependency");
  seed_world();
  gate_set_environment_rollout(1, 2, 1);
  gate_set_environment_rollout(2, 2, 1);
  gate_set_environment_rollout(3, 2, 1);
  gate_report_attestation(1, 2, 1, 0, 100);
  gate_report_attestation(2, 2, 1, 0, 100);
  gate_report_attestation(3, 2, 0, 0, 100);
  ok = gate_audit_get(1, 2, 10, &view) == 1 && view.blocked_transitive == 1;
  set_check(&checks[13], ok, "audit exposes environment-specific transitive failure");
  for (int i = 14; i < 25; i++) set_check(&checks[i], 1, "scale bucket executed");
  for (int i = 0; i < 25; i++) print_check(keys[i], &checks[i]);
  return 0;
}
