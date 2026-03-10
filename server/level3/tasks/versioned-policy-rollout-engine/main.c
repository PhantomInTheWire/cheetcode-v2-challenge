#include <stdint.h>

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

__attribute__((visibility("default"))) void policy_reset(void) {}
__attribute__((visibility("default"))) int policy_publish_snapshot(int snapshot_id, int version, int subject_id, int resource_id, int allow_mask, int deny_mask, int priority, int64_t not_before_ts, int64_t expires_ts) {
  (void)snapshot_id; (void)version; (void)subject_id; (void)resource_id; (void)allow_mask;
  (void)deny_mask; (void)priority; (void)not_before_ts; (void)expires_ts; return 0;
}
__attribute__((visibility("default"))) int policy_set_subject_binding(int subject_id, int active_version, int fallback_version) {
  (void)subject_id; (void)active_version; (void)fallback_version; return 0;
}
__attribute__((visibility("default"))) int policy_stage_version(int subject_id, int staged_version) {
  (void)subject_id; (void)staged_version; return 0;
}
__attribute__((visibility("default"))) int policy_activate_version(int subject_id) { (void)subject_id; return 0; }
__attribute__((visibility("default"))) int policy_retire_snapshot(int snapshot_id) { (void)snapshot_id; return 0; }
__attribute__((visibility("default"))) int policy_disable_snapshot(int snapshot_id) { (void)snapshot_id; return 0; }
__attribute__((visibility("default"))) int policy_check(int subject_id, int resource_id, int perm_bit, int64_t ts) {
  (void)subject_id; (void)resource_id; (void)perm_bit; (void)ts; return 0;
}
__attribute__((visibility("default"))) int policy_explain_get(int subject_id, int resource_id, int perm_bit, int64_t ts, PolicyExplainView* out_view) {
  (void)subject_id; (void)resource_id; (void)perm_bit; (void)ts; (void)out_view; return 0;
}
__attribute__((visibility("default"))) int policy_count_subject_rules(int subject_id, int64_t ts) { (void)subject_id; (void)ts; return 0; }
__attribute__((visibility("default"))) int policy_last_error(void) { return 0; }
