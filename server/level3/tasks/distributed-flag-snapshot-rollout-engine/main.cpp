#include <cstdint>

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

extern "C" {
__attribute__((visibility("default"))) void flag_reset(void) {}
__attribute__((visibility("default"))) int flag_define(int flag_id,
                                                       int default_variant_id,
                                                       int off_variant_id) {
  (void)flag_id;
  (void)default_variant_id;
  (void)off_variant_id;
  return 0;
}
__attribute__((visibility("default"))) int
flag_define_prerequisite(int flag_id, int prerequisite_flag_id,
                         int required_variant_id) {
  (void)flag_id;
  (void)prerequisite_flag_id;
  (void)required_variant_id;
  return 0;
}
__attribute__((visibility("default"))) int
flag_publish_snapshot(int snapshot_id, int flag_id, int environment_id,
                      int version, int rule_id, int segment_id, int priority,
                      int variant_id, int rollout_percent, int track_events,
                      std::int64_t not_before_ts, std::int64_t expires_ts) {
  (void)snapshot_id;
  (void)flag_id;
  (void)environment_id;
  (void)version;
  (void)rule_id;
  (void)segment_id;
  (void)priority;
  (void)variant_id;
  (void)rollout_percent;
  (void)track_events;
  (void)not_before_ts;
  (void)expires_ts;
  return 0;
}
__attribute__((visibility("default"))) int
flag_publish_tombstone(int tombstone_id, int flag_id, int environment_id,
                       int version, std::int64_t not_before_ts,
                       std::int64_t expires_ts) {
  (void)tombstone_id;
  (void)flag_id;
  (void)environment_id;
  (void)version;
  (void)not_before_ts;
  (void)expires_ts;
  return 0;
}
__attribute__((visibility("default"))) int flag_stage_version(int flag_id,
                                                              int environment_id,
                                                              int version) {
  (void)flag_id;
  (void)environment_id;
  (void)version;
  return 0;
}
__attribute__((visibility("default"))) int flag_activate_version(int flag_id,
                                                                 int environment_id) {
  (void)flag_id;
  (void)environment_id;
  return 0;
}
__attribute__((visibility("default"))) int
flag_set_fallback_version(int flag_id, int environment_id, int version) {
  (void)flag_id;
  (void)environment_id;
  (void)version;
  return 0;
}
__attribute__((visibility("default"))) int flag_disable_snapshot(int snapshot_id) {
  (void)snapshot_id;
  return 0;
}
__attribute__((visibility("default"))) int flag_retire_snapshot(int snapshot_id) {
  (void)snapshot_id;
  return 0;
}
__attribute__((visibility("default"))) int
flag_mark_replica_stale(int flag_id, int environment_id, int version,
                        int stale) {
  (void)flag_id;
  (void)environment_id;
  (void)version;
  (void)stale;
  return 0;
}
__attribute__((visibility("default"))) int
flag_register_segment_membership(int subject_id, int segment_id, int member) {
  (void)subject_id;
  (void)segment_id;
  (void)member;
  return 0;
}
__attribute__((visibility("default"))) int
flag_evaluate(int flag_id, int environment_id, int subject_id,
              int subject_bucket, std::int64_t ts) {
  (void)flag_id;
  (void)environment_id;
  (void)subject_id;
  (void)subject_bucket;
  (void)ts;
  return 0;
}
__attribute__((visibility("default"))) int
flag_explain_get(int flag_id, int environment_id, int subject_id,
                 int subject_bucket, std::int64_t ts, FlagEvalView *out_view) {
  (void)flag_id;
  (void)environment_id;
  (void)subject_id;
  (void)subject_bucket;
  (void)ts;
  (void)out_view;
  return 0;
}
__attribute__((visibility("default"))) int
flag_count_usable_snapshots(int flag_id, int environment_id, std::int64_t ts) {
  (void)flag_id;
  (void)environment_id;
  (void)ts;
  return 0;
}
__attribute__((visibility("default"))) int flag_last_error(void) { return 0; }
}
