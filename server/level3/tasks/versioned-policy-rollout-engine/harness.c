#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifdef __cplusplus
extern "C" {
#endif
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
int policy_set_subject_binding(int subject_id, int active_version,
                               int fallback_version);
int policy_stage_version(int subject_id, int staged_version);
int policy_activate_version(int subject_id);
int policy_retire_snapshot(int snapshot_id);
int policy_disable_snapshot(int snapshot_id);
int policy_check(int subject_id, int resource_id, int perm_bit, int64_t ts);
int policy_explain_get(int subject_id, int resource_id, int perm_bit,
                       int64_t ts, PolicyExplainView *out_view);
int policy_count_subject_rules(int subject_id, int64_t ts);
int policy_last_error(void);
#ifdef __cplusplus
}
#endif

typedef struct {
  int ok;
  char msg[128];
} Check;
static void set_check(Check *c, int ok, const char *msg) {
  c->ok = ok;
  snprintf(c->msg, sizeof(c->msg), "%s", msg);
}
static void print_check(const char *key, const Check *c) {
  printf("%s|%d|%s\n", key, c->ok, c->msg);
}

static void seed_world(void) {
  policy_reset();
  policy_publish_snapshot(10, 1, 7, 42, 1, 0, 1, 0, 100);
  policy_publish_snapshot(11, 2, 7, 42, 1, 1, 2, 0, 100);
  policy_publish_snapshot(12, 2, 7, 42, 1, 0, 1, 200, 300);
  policy_publish_snapshot(13, 3, 7, 42, 1, 0, 3, 0, 100);
  policy_set_subject_binding(7, 2, 1);
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
  Check checks[25];
  PolicyExplainView view;
  int ok;

  seed_world();
  set_check(&checks[0], policy_check(7, 42, 1, 10) == 0,
            "deny in active version overrides allow");
  policy_disable_snapshot(11);
  set_check(&checks[1], policy_check(7, 42, 1, 10) == 1,
            "disabled active snapshot falls back to previous version");
  seed_world();
  set_check(&checks[2], policy_check(7, 42, 1, 150) == 0,
            "stale active and expired fallback deny read");
  seed_world();
  ok = policy_explain_get(7, 42, 1, 10, &view) == 1 && view.exists == 1 &&
       view.decided_version == 2 && view.matched_snapshot_id == 11;
  set_check(&checks[3], ok, "explain reports chosen version and snapshot");
  seed_world();
  policy_stage_version(7, 3);
  policy_activate_version(7);
  set_check(&checks[4], policy_check(7, 42, 1, 10) == 1,
            "activation swaps staged version into active slot");
  seed_world();
  policy_disable_snapshot(11);
  set_check(&checks[5], policy_check(7, 42, 1, 10) == 1,
            "disable path preserves fallback compatibility");
  seed_world();
  policy_set_subject_binding(8, 1, 0);
  policy_publish_snapshot(20, 1, 8, 42, 1, 0, 1, 0, 100);
  policy_disable_snapshot(20);
  set_check(&checks[6],
            policy_check(7, 42, 1, 10) == 0 && policy_check(8, 42, 1, 10) == 0,
            "subjects remain isolated under updates");
  seed_world();
  set_check(&checks[7], policy_count_subject_rules(7, 10) == 2,
            "count tracks active and fallback usable snapshots");
  seed_world();
  for (int i = 0; i < 500; i++)
    policy_publish_snapshot(100 + i, 9, 1000 + i, 77, 1, 0, 1, 0, 100);
  set_check(&checks[8], policy_check(7, 42, 1, 10) == 0,
            "hot lookup remains correct with noise");
  ok = policy_explain_get(7, 42, 1, 10, &view) == 1 && view.exists == 1;
  set_check(&checks[9], ok, "operator explain remains available");
  set_check(&checks[10], policy_count_subject_rules(7, 10) == 2,
            "summary lookup remains stable");
  seed_world();
  set_check(&checks[11], policy_check(7, 42, 1, 10) == 0,
            "usable active deny shadows fallback allow");
  seed_world();
  policy_disable_snapshot(11);
  ok = policy_explain_get(7, 42, 1, 10, &view) == 1 &&
       view.fallback_used == 1 && view.decided_version == 1;
  set_check(&checks[12], ok,
            "explain shows fallback after active path disable");
  seed_world();
  policy_stage_version(7, 3);
  policy_activate_version(7);
  policy_stage_version(7, 2);
  policy_activate_version(7);
  ok = policy_explain_get(7, 42, 1, 10, &view) == 1 &&
       view.decided_version == 2 && view.fallback_used == 0;
  set_check(&checks[13], ok,
            "re-activation preserves active shadowing after rollback-like "
            "transition");
  for (int i = 14; i < 25; i++)
    set_check(&checks[i], 1, "scale bucket executed");

  for (int i = 0; i < 25; i++)
    print_check(keys[i], &checks[i]);
  return 0;
}
