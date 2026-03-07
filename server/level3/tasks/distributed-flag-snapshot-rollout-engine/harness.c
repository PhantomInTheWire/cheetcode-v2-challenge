#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif
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
int flag_define_prerequisite(int flag_id, int prerequisite_flag_id,
                             int required_variant_id);
int flag_publish_snapshot(int snapshot_id, int flag_id, int environment_id,
                          int version, int rule_id, int segment_id,
                          int priority, int variant_id, int rollout_percent,
                          int track_events, int64_t not_before_ts,
                          int64_t expires_ts);
int flag_publish_tombstone(int tombstone_id, int flag_id, int environment_id,
                           int version, int64_t not_before_ts,
                           int64_t expires_ts);
int flag_stage_version(int flag_id, int environment_id, int version);
int flag_activate_version(int flag_id, int environment_id);
int flag_set_fallback_version(int flag_id, int environment_id, int version);
int flag_disable_snapshot(int snapshot_id);
int flag_retire_snapshot(int snapshot_id);
int flag_mark_replica_stale(int flag_id, int environment_id, int version,
                            int stale);
int flag_register_segment_membership(int subject_id, int segment_id, int member);
int flag_evaluate(int flag_id, int environment_id, int subject_id,
                  int subject_bucket, int64_t ts);
int flag_explain_get(int flag_id, int environment_id, int subject_id,
                     int subject_bucket, int64_t ts, FlagEvalView *out_view);
int flag_count_usable_snapshots(int flag_id, int environment_id, int64_t ts);
int flag_last_error(void);
#ifdef __cplusplus
}
#endif

typedef struct {
  int ok;
  char msg[160];
} Check;

static volatile int benchmark_sink = 0;

static void set_check(Check *check, int ok, const char *msg) {
  check->ok = ok;
  snprintf(check->msg, sizeof(check->msg), "%s", msg);
}

static void print_check(const char *key, const Check *check) {
  printf("%s|%d|%s\n", key, check->ok, check->msg);
}

static uint64_t now_ns(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (uint64_t)ts.tv_sec * 1000000000ull + (uint64_t)ts.tv_nsec;
}

static uint64_t benchmark_eval_loop(int loops, int flag_id, int environment_id,
                                    int subject_id, int subject_bucket,
                                    int64_t ts) {
  uint64_t start = now_ns();
  int acc = 0;
  for (int i = 0; i < loops; i++)
    acc += flag_evaluate(flag_id, environment_id, subject_id, subject_bucket, ts);
  benchmark_sink = acc;
  return now_ns() - start;
}

static uint64_t benchmark_explain_loop(int loops, int flag_id, int environment_id,
                                       int subject_id, int subject_bucket,
                                       int64_t ts) {
  uint64_t start = now_ns();
  int acc = 0;
  FlagEvalView view;
  for (int i = 0; i < loops; i++) {
    acc += flag_explain_get(flag_id, environment_id, subject_id, subject_bucket, ts, &view);
    acc += view.decided_variant_id;
  }
  benchmark_sink = acc;
  return now_ns() - start;
}

static uint64_t benchmark_count_loop(int loops, int flag_id, int environment_id,
                                     int64_t ts) {
  uint64_t start = now_ns();
  int acc = 0;
  for (int i = 0; i < loops; i++)
    acc += flag_count_usable_snapshots(flag_id, environment_id, ts);
  benchmark_sink = acc;
  return now_ns() - start;
}

static uint64_t benchmark_mixed_loop(int loops) {
  uint64_t start = now_ns();
  int acc = 0;
  for (int i = 0; i < loops; i++) {
    acc += flag_evaluate(1, 1, (i & 1) ? 51 : 50, 30, 10);
    acc += flag_evaluate(4, (i & 1) ? 2 : 1, 50, 10, 10);
  }
  benchmark_sink = acc;
  return now_ns() - start;
}

static int ratio_within(uint64_t baseline_ns, uint64_t noisy_ns, int ratio_limit) {
  if (baseline_ns == 0)
    baseline_ns = 1;
  return noisy_ns <= baseline_ns * (uint64_t)ratio_limit;
}

static void seed_rollout_world(void) {
  flag_reset();

  flag_define(1, 101, 100);
  flag_define(2, 201, 200);
  flag_define(3, 301, 300);
  flag_define(4, 401, 400);

  flag_define_prerequisite(1, 2, 210);
  flag_define_prerequisite(2, 3, 310);

  flag_register_segment_membership(50, 9, 1);
  flag_register_segment_membership(51, 9, 0);
  flag_register_segment_membership(70, 15, 1);

  flag_publish_snapshot(1001, 3, 1, 1, 1, 0, 5, 310, 100, 0, 0, 1000);
  flag_publish_snapshot(1002, 2, 1, 1, 1, 0, 5, 210, 100, 0, 0, 1000);

  flag_publish_snapshot(1101, 1, 1, 1, 50, 0, 1, 111, 100, 0, 0, 1000);
  flag_publish_snapshot(1102, 1, 1, 2, 20, 0, 2, 120, 100, 0, 0, 1000);
  flag_publish_snapshot(1103, 1, 1, 2, 10, 9, 5, 130, 100, 0, 0, 1000);
  flag_publish_snapshot(1104, 1, 1, 2, 9, 9, 5, 131, 100, 0, 0, 1000);
  flag_publish_snapshot(1105, 1, 1, 2, 30, 15, 10, 140, 100, 0, 0, 1000);
  flag_publish_snapshot(1106, 1, 1, 2, 40, 0, 6, 150, 25, 0, 0, 1000);
  flag_publish_snapshot(1107, 1, 1, 2, 60, 0, 3, 160, 100, 0, 200, 260);
  flag_publish_snapshot(1108, 1, 1, 2, 70, 0, 4, 170, 100, 0, 0, 1000);

  flag_publish_snapshot(1201, 4, 1, 1, 1, 0, 4, 410, 100, 0, 0, 1000);
  flag_publish_snapshot(1202, 4, 2, 1, 1, 0, 4, 420, 100, 0, 0, 1000);

  flag_stage_version(1, 1, 1);
  flag_activate_version(1, 1);
  flag_stage_version(1, 1, 2);
  flag_activate_version(1, 1);

  flag_stage_version(2, 1, 1);
  flag_activate_version(2, 1);
  flag_stage_version(3, 1, 1);
  flag_activate_version(3, 1);
  flag_stage_version(4, 1, 1);
  flag_activate_version(4, 1);
  flag_stage_version(4, 2, 1);
  flag_activate_version(4, 2);
}

static int hot_reads(int loops, int expect_variant) {
  int ok = 1;
  for (int i = 0; i < loops; i++) {
    if (flag_evaluate(1, 1, 50, 30, 10) != expect_variant) {
      ok = 0;
      break;
    }
  }
  return ok;
}

int main(void) {
  const char *keys[25] = {
      "behavior_rule_precedence",
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
  FlagEvalView view;
  int ok;

  seed_rollout_world();
  set_check(&checks[0], flag_evaluate(1, 1, 50, 30, 10) == 131,
            "priority tie breaks by segment then lower rule id");

  seed_rollout_world();
  flag_mark_replica_stale(1, 1, 2, 1);
  set_check(&checks[1], flag_evaluate(1, 1, 51, 80, 10) == 111,
            "stale active version falls back to previous version");

  seed_rollout_world();
  flag_mark_replica_stale(2, 1, 1, 1);
  set_check(&checks[2], flag_evaluate(1, 1, 50, 10, 10) == 100,
            "prerequisite failure forces off variant");

  seed_rollout_world();
  ok = flag_explain_get(1, 1, 50, 30, 10, &view) == 1 && view.exists == 1 &&
       view.decided_version == 2 && view.matched_snapshot_id == 1104 &&
       view.decided_variant_id == 131 && view.fallback_used == 0 &&
       view.prerequisite_failed == 0 && view.usable == 1;
  set_check(&checks[3], ok, "audit reports chosen active snapshot and version");

  seed_rollout_world();
  flag_stage_version(1, 1, 3);
  flag_publish_snapshot(1301, 1, 1, 3, 1, 0, 9, 180, 100, 0, 0, 1000);
  flag_activate_version(1, 1);
  set_check(&checks[4], flag_evaluate(1, 1, 50, 10, 10) == 180,
            "activation promotes staged version into active slot");

  seed_rollout_world();
  flag_publish_tombstone(9001, 1, 1, 2, 0, 1000);
  ok = flag_explain_get(1, 1, 51, 80, 10, &view) == 1 &&
       view.fallback_used == 1 && view.tombstone_blocked == 1 &&
       view.decided_variant_id == 111;
  set_check(&checks[5], ok, "tombstoned active version routes to fallback");

  seed_rollout_world();
  ok = flag_evaluate(4, 1, 50, 10, 10) == 410 &&
       flag_evaluate(4, 2, 50, 10, 10) == 420;
  set_check(&checks[6], ok,
            "environment-scoped activation remains isolated per environment");

  seed_rollout_world();
  flag_define(5, 501, 500);
  flag_publish_snapshot(1501, 5, 1, 1, 1, 15, 5, 510, 100, 0, 0, 1000);
  flag_stage_version(5, 1, 1);
  flag_activate_version(5, 1);
  ok = flag_evaluate(5, 1, 51, 90, 10) == 501 &&
       flag_explain_get(5, 1, 51, 90, 10, &view) == 1 &&
       view.off_by_targeting == 1 && view.decided_variant_id == 501;
  set_check(&checks[7], ok,
            "default path remains explain-visible when no rule matches");

  seed_rollout_world();
  {
    uint64_t baseline = benchmark_eval_loop(4000, 1, 1, 50, 30, 10);
    uint64_t noisy;
  for (int i = 0; i < 700; i++) {
    flag_define(100 + i, 5000 + i, 4900 + i);
    flag_publish_snapshot(2000 + i, 100 + i, 3, 1, 1, 0, 1, 6000 + i, 100, 0,
                          0, 1000);
    flag_stage_version(100 + i, 3, 1);
    flag_activate_version(100 + i, 3);
  }
    noisy = benchmark_eval_loop(4000, 1, 1, 50, 30, 10);
    set_check(&checks[8], flag_evaluate(1, 1, 50, 30, 10) == 131 &&
                              ratio_within(baseline, noisy, 16),
            "lookup stays correct with large irrelevant flag population");
  }

  seed_rollout_world();
  {
    uint64_t baseline = benchmark_explain_loop(2000, 1, 1, 50, 30, 10);
    uint64_t noisy;
    for (int i = 0; i < 500; i++) {
      flag_register_segment_membership(3000 + i, 9, i & 1);
      flag_register_segment_membership(3000 + i, 15, 1);
    }
    noisy = benchmark_explain_loop(2000, 1, 1, 50, 30, 10);
    ok = flag_explain_get(1, 1, 50, 30, 10, &view) == 1 &&
         view.matched_snapshot_id == 1104 && ratio_within(baseline, noisy, 18);
  }
  set_check(&checks[9], ok, "repeated operator explain reads stay stable");

  seed_rollout_world();
  {
    uint64_t baseline = benchmark_count_loop(6000, 1, 1, 10);
    uint64_t noisy;
    for (int i = 0; i < 500; i++) {
      flag_define(2000 + i, 7000 + i, 6900 + i);
      flag_publish_snapshot(5000 + i, 2000 + i, 1, 1, 1, 0, 1, 7100 + i, 100, 0,
                            0, 1000);
      flag_stage_version(2000 + i, 1, 1);
      flag_activate_version(2000 + i, 1);
    }
    noisy = benchmark_count_loop(6000, 1, 1, 10);
    set_check(&checks[10], flag_count_usable_snapshots(1, 1, 10) == 7 &&
                              ratio_within(baseline, noisy, 12),
            "summary counts active and fallback usable snapshots");
  }

  seed_rollout_world();
  set_check(&checks[11], hot_reads(800, 131),
            "hot read loop preserves active targeting result");

  seed_rollout_world();
  {
    uint64_t baseline = benchmark_eval_loop(4000, 1, 1, 50, 30, 10);
    uint64_t noisy;
    for (int i = 0; i < 400; i++)
      flag_register_segment_membership(1000 + i, 9, i & 1);
    noisy = benchmark_eval_loop(4000, 1, 1, 50, 30, 10);
    set_check(&checks[12], flag_evaluate(1, 1, 50, 30, 10) == 131 &&
                              ratio_within(baseline, noisy, 12),
            "same-subject noise does not perturb hot subject reads");
  }

  seed_rollout_world();
  {
    uint64_t baseline = benchmark_eval_loop(4000, 1, 1, 51, 30, 10);
    uint64_t noisy;
    for (int i = 0; i < 400; i++)
      flag_register_segment_membership(2000 + i, 15, 1);
    noisy = benchmark_eval_loop(4000, 1, 1, 51, 30, 10);
    set_check(&checks[13], flag_evaluate(1, 1, 51, 30, 10) == 170 &&
                              ratio_within(baseline, noisy, 12),
            "other-subject segment noise preserves global targeting semantics");
  }

  seed_rollout_world();
  flag_publish_snapshot(1401, 1, 1, 4, 1, 0, 11, 190, 100, 0, 0, 1000);
  flag_stage_version(1, 1, 4);
  set_check(&checks[14], flag_evaluate(1, 1, 50, 30, 10) == 131,
            "staged versions do not affect reads before activation");

  seed_rollout_world();
  flag_mark_replica_stale(1, 1, 2, 1);
  ok = flag_explain_get(1, 1, 50, 30, 10, &view) == 1 &&
       view.stale_active_seen == 1 && view.fallback_used == 1 &&
       view.decided_variant_id == 111;
  set_check(&checks[15], ok, "stale active marker is explain-visible");

  seed_rollout_world();
  flag_disable_snapshot(1104);
  set_check(&checks[16], flag_evaluate(1, 1, 50, 30, 10) == 130,
            "disabled winning rule drops to next deterministic candidate");

  seed_rollout_world();
  flag_mark_replica_stale(1, 1, 1, 1);
  set_check(&checks[17], flag_count_usable_snapshots(1, 1, 10) == 6 &&
                            ratio_within(benchmark_count_loop(1000, 1, 1, 10),
                                         benchmark_count_loop(6000, 1, 1, 10), 14),
            "summary excludes stale fallback version");

  seed_rollout_world();
  flag_publish_tombstone(9002, 1, 1, 1, 0, 1000);
  set_check(&checks[18], flag_count_usable_snapshots(1, 1, 10) == 6 &&
                            ratio_within(benchmark_count_loop(1000, 1, 1, 10),
                                         benchmark_count_loop(6000, 1, 1, 10), 14),
            "summary excludes tombstoned fallback version");

  seed_rollout_world();
  ok = 1;
  for (int i = 0; i < 200; i++) {
    int expected = (i & 1) ? 170 : 131;
    int subject = (i & 1) ? 51 : 50;
    int bucket = 30;
    if (flag_evaluate(1, 1, subject, bucket, 10) != expected) {
      ok = 0;
      break;
    }
  }
  set_check(&checks[19], ok, "mixed read loops remain deterministic");

  seed_rollout_world();
  {
    uint64_t baseline = benchmark_eval_loop(3000, 1, 1, 50, 30, 10);
    uint64_t deep;
    flag_define_prerequisite(1, 4, 410);
    deep = benchmark_eval_loop(3000, 1, 1, 50, 30, 10);
    set_check(&checks[20], flag_evaluate(1, 1, 50, 30, 10) == 131 &&
                              ratio_within(baseline, deep, 16),
            "multi-hop dependency chains stay satisfiable");
  }

  seed_rollout_world();
  set_check(&checks[21], flag_evaluate(1, 1, 50, 30, 10) == 131 &&
                            flag_evaluate(1, 1, 50, 30, 220) == 131,
            "hot rollout remains stable across unrelated time windows");

  seed_rollout_world();
  flag_disable_snapshot(1104);
  flag_mark_replica_stale(1, 1, 2, 1);
  set_check(&checks[22], flag_evaluate(1, 1, 50, 30, 10) == 111,
            "localized active fix still preserves fallback safety");

  seed_rollout_world();
  flag_define(5, 501, 500);
  flag_publish_snapshot(1501, 5, 1, 1, 1, 15, 5, 510, 100, 0, 0, 1000);
  flag_stage_version(5, 1, 1);
  flag_activate_version(5, 1);
  ok = 1;
  for (int i = 0; i < 120; i++) {
    if (flag_explain_get(5, 1, 51, 90, 10, &view) != 1 ||
        view.off_by_targeting != 1 || view.decided_variant_id != 501) {
      ok = 0;
      break;
    }
  }
  set_check(&checks[23], ok, "operator queries preserve targeting diagnostics");

  seed_rollout_world();
  ok = hot_reads(400, 131) && flag_evaluate(1, 1, 51, 30, 10) == 170 &&
       flag_evaluate(4, 2, 50, 10, 10) == 420 &&
       flag_count_usable_snapshots(1, 1, 10) == 7 &&
       ratio_within(benchmark_eval_loop(6000, 1, 1, 50, 30, 10),
                    benchmark_mixed_loop(6000), 28);
  set_check(&checks[24], ok,
            "large mixed trace preserves rollout, isolation, and summaries");

  for (int i = 0; i < 25; i++)
    print_check(keys[i], &checks[i]);
  return 0;
}
