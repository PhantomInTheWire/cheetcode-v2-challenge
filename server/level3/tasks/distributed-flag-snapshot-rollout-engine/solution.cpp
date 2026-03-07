extern "C" {
#include <stdint.h>
#include <string.h>

enum {
  FLAG_MAX_FLAGS = 128,
  FLAG_MAX_PREREQS = 8,
  FLAG_MAX_SNAPSHOTS = 4096,
  FLAG_MAX_TOMBSTONES = 512,
  FLAG_MAX_BINDINGS = 512,
  FLAG_MAX_STALE = 512,
  FLAG_MAX_MEMBERSHIPS = 4096,
  FLAG_OK = 0,
  FLAG_ERR_DUPLICATE_FLAG = 1,
  FLAG_ERR_DUPLICATE_SNAPSHOT = 2,
  FLAG_ERR_DUPLICATE_TOMBSTONE = 3,
  FLAG_ERR_UNKNOWN_FLAG = 4,
  FLAG_ERR_UNKNOWN_SNAPSHOT = 5,
  FLAG_ERR_BAD_ROLLOUT = 6,
  FLAG_ERR_UNKNOWN_BINDING = 7,
  FLAG_ERR_UNKNOWN_PREREQ = 8,
  FLAG_ERR_PREREQ_CYCLE = 9,
  FLAG_ERR_OUT = 10,
  FLAG_ERR_CAPACITY = 11
};

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

typedef struct {
  int used;
  int id;
  int default_variant_id;
  int off_variant_id;
  int prereq_count;
  int prereq_flag_ids[FLAG_MAX_PREREQS];
  int prereq_variants[FLAG_MAX_PREREQS];
} FlagDef;

typedef struct {
  int used;
  int id;
  int flag_id;
  int environment_id;
  int version;
  int rule_id;
  int segment_id;
  int priority;
  int variant_id;
  int rollout_percent;
  int track_events;
  int retired;
  int disabled;
  int64_t not_before_ts;
  int64_t expires_ts;
} Snapshot;

typedef struct {
  int used;
  int id;
  int flag_id;
  int environment_id;
  int version;
  int64_t not_before_ts;
  int64_t expires_ts;
} Tombstone;

typedef struct {
  int used;
  int flag_id;
  int environment_id;
  int has_active_version;
  int active_version;
  int has_staged_version;
  int staged_version;
  int has_fallback_version;
  int fallback_version;
} Binding;

typedef struct {
  int used;
  int flag_id;
  int environment_id;
  int version;
  int stale;
} ReplicaState;

typedef struct {
  int used;
  int subject_id;
  int segment_id;
  int member;
} Membership;

typedef struct {
  int has_any;
  int has_usable_population;
  int has_disabled_or_retired;
  int best_index;
} VersionScan;

static FlagDef flags[FLAG_MAX_FLAGS];
static Snapshot snapshots[FLAG_MAX_SNAPSHOTS];
static Tombstone tombstones[FLAG_MAX_TOMBSTONES];
static Binding bindings[FLAG_MAX_BINDINGS];
static ReplicaState replica_states[FLAG_MAX_STALE];
static Membership memberships[FLAG_MAX_MEMBERSHIPS];
static int last_error = FLAG_OK;

static int flag_index_by_id(int flag_id) {
  for (int i = 0; i < FLAG_MAX_FLAGS; i++) {
    if (flags[i].used && flags[i].id == flag_id)
      return i;
  }
  return -1;
}

static FlagDef *flag_by_id(int flag_id) {
  int index = flag_index_by_id(flag_id);
  return index >= 0 ? &flags[index] : 0;
}

static Snapshot *snapshot_by_id(int snapshot_id) {
  for (int i = 0; i < FLAG_MAX_SNAPSHOTS; i++) {
    if (snapshots[i].used && snapshots[i].id == snapshot_id)
      return &snapshots[i];
  }
  return 0;
}

static Tombstone *tombstone_by_id(int tombstone_id) {
  for (int i = 0; i < FLAG_MAX_TOMBSTONES; i++) {
    if (tombstones[i].used && tombstones[i].id == tombstone_id)
      return &tombstones[i];
  }
  return 0;
}

static Binding *binding_for(int flag_id, int environment_id, int create) {
  for (int i = 0; i < FLAG_MAX_BINDINGS; i++) {
    if (bindings[i].used && bindings[i].flag_id == flag_id &&
        bindings[i].environment_id == environment_id)
      return &bindings[i];
  }
  if (!create)
    return 0;
  for (int i = 0; i < FLAG_MAX_BINDINGS; i++) {
    if (!bindings[i].used) {
      memset(&bindings[i], 0, sizeof(Binding));
      bindings[i].used = 1;
      bindings[i].flag_id = flag_id;
      bindings[i].environment_id = environment_id;
      return &bindings[i];
    }
  }
  return 0;
}

static ReplicaState *replica_state_for(int flag_id, int environment_id,
                                       int version, int create) {
  for (int i = 0; i < FLAG_MAX_STALE; i++) {
    if (replica_states[i].used && replica_states[i].flag_id == flag_id &&
        replica_states[i].environment_id == environment_id &&
        replica_states[i].version == version)
      return &replica_states[i];
  }
  if (!create)
    return 0;
  for (int i = 0; i < FLAG_MAX_STALE; i++) {
    if (!replica_states[i].used) {
      memset(&replica_states[i], 0, sizeof(ReplicaState));
      replica_states[i].used = 1;
      replica_states[i].flag_id = flag_id;
      replica_states[i].environment_id = environment_id;
      replica_states[i].version = version;
      return &replica_states[i];
    }
  }
  return 0;
}

static Membership *membership_for(int subject_id, int segment_id, int create) {
  for (int i = 0; i < FLAG_MAX_MEMBERSHIPS; i++) {
    if (memberships[i].used && memberships[i].subject_id == subject_id &&
        memberships[i].segment_id == segment_id)
      return &memberships[i];
  }
  if (!create)
    return 0;
  for (int i = 0; i < FLAG_MAX_MEMBERSHIPS; i++) {
    if (!memberships[i].used) {
      memset(&memberships[i], 0, sizeof(Membership));
      memberships[i].used = 1;
      memberships[i].subject_id = subject_id;
      memberships[i].segment_id = segment_id;
      return &memberships[i];
    }
  }
  return 0;
}

static int segment_member(int subject_id, int segment_id) {
  Membership *membership;
  if (segment_id == 0)
    return 1;
  membership = membership_for(subject_id, segment_id, 0);
  return membership ? membership->member : 0;
}

static int snapshot_directly_usable(const Snapshot *snapshot, int64_t ts) {
  return snapshot->used && !snapshot->retired && !snapshot->disabled &&
         ts >= snapshot->not_before_ts && ts < snapshot->expires_ts;
}

static int tombstone_usable(const Tombstone *tombstone, int64_t ts) {
  return tombstone->used && ts >= tombstone->not_before_ts &&
         ts < tombstone->expires_ts;
}

static int version_tombstoned(int flag_id, int environment_id, int version,
                              int64_t ts) {
  for (int i = 0; i < FLAG_MAX_TOMBSTONES; i++) {
    Tombstone *tombstone = &tombstones[i];
    if (!tombstone->used || tombstone->flag_id != flag_id ||
        tombstone->environment_id != environment_id ||
        tombstone->version != version)
      continue;
    if (tombstone_usable(tombstone, ts))
      return 1;
  }
  return 0;
}

static int version_known(int flag_id, int environment_id, int version) {
  for (int i = 0; i < FLAG_MAX_SNAPSHOTS; i++) {
    if (snapshots[i].used && snapshots[i].flag_id == flag_id &&
        snapshots[i].environment_id == environment_id &&
        snapshots[i].version == version)
      return 1;
  }
  for (int i = 0; i < FLAG_MAX_TOMBSTONES; i++) {
    if (tombstones[i].used && tombstones[i].flag_id == flag_id &&
        tombstones[i].environment_id == environment_id &&
        tombstones[i].version == version)
      return 1;
  }
  for (int i = 0; i < FLAG_MAX_STALE; i++) {
    if (replica_states[i].used && replica_states[i].flag_id == flag_id &&
        replica_states[i].environment_id == environment_id &&
        replica_states[i].version == version)
      return 1;
  }
  return 0;
}

static int version_replica_stale(int flag_id, int environment_id, int version) {
  ReplicaState *state = replica_state_for(flag_id, environment_id, version, 0);
  return state ? state->stale : 0;
}

static int snapshot_matches_subject(const Snapshot *snapshot, int subject_id,
                                    int subject_bucket) {
  if (!segment_member(subject_id, snapshot->segment_id))
    return 0;
  if (subject_bucket < 0 || subject_bucket >= 100)
    return 0;
  return subject_bucket < snapshot->rollout_percent;
}

static int better_snapshot(const Snapshot *candidate, const Snapshot *best) {
  int candidate_specific = candidate->segment_id > 0 ? 1 : 0;
  int best_specific = best->segment_id > 0 ? 1 : 0;
  if (candidate->priority != best->priority)
    return candidate->priority > best->priority;
  if (candidate_specific != best_specific)
    return candidate_specific > best_specific;
  if (candidate->rule_id != best->rule_id)
    return candidate->rule_id < best->rule_id;
  return candidate->id < best->id;
}

static VersionScan scan_version(int flag_id, int environment_id, int version,
                                int subject_id, int subject_bucket,
                                int64_t ts) {
  VersionScan scan;
  memset(&scan, 0, sizeof(scan));
  scan.best_index = -1;

  for (int i = 0; i < FLAG_MAX_SNAPSHOTS; i++) {
    Snapshot *snapshot = &snapshots[i];
    if (!snapshot->used || snapshot->flag_id != flag_id ||
        snapshot->environment_id != environment_id ||
        snapshot->version != version)
      continue;
    scan.has_any = 1;
    if (snapshot->retired || snapshot->disabled)
      scan.has_disabled_or_retired = 1;
    if (!snapshot_directly_usable(snapshot, ts))
      continue;
    scan.has_usable_population = 1;
    if (!snapshot_matches_subject(snapshot, subject_id, subject_bucket))
      continue;
    if (scan.best_index < 0 ||
        better_snapshot(snapshot, &snapshots[scan.best_index])) {
      scan.best_index = i;
    }
  }
  return scan;
}

static int has_path_to_flag(int current_flag_id, int target_flag_id,
                            int *seen_ids, int seen_count) {
  FlagDef *flag = flag_by_id(current_flag_id);
  if (!flag)
    return 0;
  if (current_flag_id == target_flag_id)
    return 1;
  for (int i = 0; i < seen_count; i++) {
    if (seen_ids[i] == current_flag_id)
      return 0;
  }
  seen_ids[seen_count++] = current_flag_id;
  for (int i = 0; i < flag->prereq_count; i++) {
    if (has_path_to_flag(flag->prereq_flag_ids[i], target_flag_id, seen_ids,
                         seen_count))
      return 1;
  }
  return 0;
}

static int evaluate_flag_internal(int flag_id, int environment_id, int subject_id,
                                  int subject_bucket, int64_t ts,
                                  FlagEvalView *out_view, int *stack,
                                  int depth);

static int evaluate_prerequisites(FlagDef *flag, int environment_id,
                                  int subject_id, int subject_bucket,
                                  int64_t ts, int *stack, int depth) {
  for (int i = 0; i < flag->prereq_count; i++) {
    int required_variant = flag->prereq_variants[i];
    int actual_variant = evaluate_flag_internal(flag->prereq_flag_ids[i],
                                                environment_id, subject_id,
                                                subject_bucket, ts, 0, stack,
                                                depth + 1);
    if (actual_variant != required_variant)
      return 0;
  }
  return 1;
}

static int evaluate_flag_internal(int flag_id, int environment_id, int subject_id,
                                  int subject_bucket, int64_t ts,
                                  FlagEvalView *out_view, int *stack,
                                  int depth) {
  FlagDef *flag = flag_by_id(flag_id);
  Binding *binding;
  VersionScan active_scan;
  VersionScan fallback_scan;
  int has_active_version = 0;
  int active_version = 0;
  int has_fallback_version = 0;
  int fallback_version = 0;
  int chose_fallback = 0;
  int chosen_version = 0;
  int chosen_variant = 0;
  int chosen_snapshot_index = -1;
  int readable_path = 0;
  int off_by_targeting = 0;
  int prerequisite_failed = 0;
  int tombstone_blocked = 0;
  int stale_active_seen = 0;
  int disabled_active_seen = 0;
  int exists = flag ? 1 : 0;

  if (out_view)
    memset(out_view, 0, sizeof(*out_view));
  if (!flag)
    return 0;

  if (depth > FLAG_MAX_FLAGS)
    return flag->off_variant_id;

  for (int i = 0; i < depth; i++) {
    if (stack[i] == flag_id)
      return flag->off_variant_id;
  }
  stack[depth] = flag_id;

  binding = binding_for(flag_id, environment_id, 0);
  if (binding) {
    has_active_version = binding->has_active_version;
    active_version = binding->active_version;
    has_fallback_version = binding->has_fallback_version;
    fallback_version = binding->fallback_version;
  }

  memset(&active_scan, 0, sizeof(active_scan));
  memset(&fallback_scan, 0, sizeof(fallback_scan));
  active_scan.best_index = -1;
  fallback_scan.best_index = -1;

  if (has_active_version) {
    if (version_replica_stale(flag_id, environment_id, active_version)) {
      stale_active_seen = 1;
    } else if (version_tombstoned(flag_id, environment_id, active_version, ts)) {
      tombstone_blocked = 1;
    } else {
      active_scan = scan_version(flag_id, environment_id, active_version,
                                 subject_id, subject_bucket, ts);
      disabled_active_seen = active_scan.has_disabled_or_retired;
      if (active_scan.best_index >= 0) {
        readable_path = 1;
        chosen_version = active_version;
        chosen_snapshot_index = active_scan.best_index;
        chosen_variant = snapshots[chosen_snapshot_index].variant_id;
      } else if (active_scan.has_usable_population) {
        readable_path = 1;
        chosen_version = active_version;
        chosen_variant = flag->default_variant_id;
        off_by_targeting = 1;
      }
    }
  }

  if (!readable_path && has_fallback_version) {
    if (version_replica_stale(flag_id, environment_id, fallback_version)) {
      /* blocked fallback */
    } else if (version_tombstoned(flag_id, environment_id, fallback_version, ts)) {
      tombstone_blocked = 1;
    } else {
      fallback_scan = scan_version(flag_id, environment_id, fallback_version,
                                   subject_id, subject_bucket, ts);
      if (fallback_scan.best_index >= 0) {
        readable_path = 1;
        chose_fallback = 1;
        chosen_version = fallback_version;
        chosen_snapshot_index = fallback_scan.best_index;
        chosen_variant = snapshots[chosen_snapshot_index].variant_id;
      } else if (fallback_scan.has_usable_population) {
        readable_path = 1;
        chose_fallback = 1;
        chosen_version = fallback_version;
        chosen_variant = flag->default_variant_id;
        off_by_targeting = 1;
      }
    }
  }

  if (!readable_path) {
    chosen_variant = flag->off_variant_id;
  } else if (!evaluate_prerequisites(flag, environment_id, subject_id,
                                     subject_bucket, ts, stack, depth)) {
    prerequisite_failed = 1;
    chosen_variant = flag->off_variant_id;
  }

  if (out_view) {
    out_view->exists = exists;
    out_view->environment_id = environment_id;
    out_view->decided_version = chosen_version;
    if (chosen_snapshot_index >= 0) {
      out_view->matched_snapshot_id = snapshots[chosen_snapshot_index].id;
      out_view->matched_rule_id = snapshots[chosen_snapshot_index].rule_id;
    }
    out_view->decided_variant_id = chosen_variant;
    out_view->fallback_used = chose_fallback;
    out_view->tombstone_blocked = tombstone_blocked;
    out_view->stale_active_seen = stale_active_seen;
    out_view->disabled_active_seen = disabled_active_seen;
    out_view->prerequisite_failed = prerequisite_failed;
    out_view->off_by_targeting = off_by_targeting;
    out_view->usable = readable_path;
  }

  return chosen_variant;
}

__attribute__((visibility("default"))) void flag_reset(void) {
  memset(flags, 0, sizeof(flags));
  memset(snapshots, 0, sizeof(snapshots));
  memset(tombstones, 0, sizeof(tombstones));
  memset(bindings, 0, sizeof(bindings));
  memset(replica_states, 0, sizeof(replica_states));
  memset(memberships, 0, sizeof(memberships));
  last_error = FLAG_OK;
}

__attribute__((visibility("default"))) int flag_define(int flag_id,
                                                       int default_variant_id,
                                                       int off_variant_id) {
  if (flag_by_id(flag_id)) {
    last_error = FLAG_ERR_DUPLICATE_FLAG;
    return 0;
  }
  for (int i = 0; i < FLAG_MAX_FLAGS; i++) {
    if (!flags[i].used) {
      memset(&flags[i], 0, sizeof(FlagDef));
      flags[i].used = 1;
      flags[i].id = flag_id;
      flags[i].default_variant_id = default_variant_id;
      flags[i].off_variant_id = off_variant_id;
      last_error = FLAG_OK;
      return 1;
    }
  }
  last_error = FLAG_ERR_CAPACITY;
  return 0;
}

__attribute__((visibility("default"))) int
flag_define_prerequisite(int flag_id, int prerequisite_flag_id,
                         int required_variant_id) {
  FlagDef *flag = flag_by_id(flag_id);
  FlagDef *prerequisite = flag_by_id(prerequisite_flag_id);
  int seen[FLAG_MAX_FLAGS];
  if (!flag || !prerequisite) {
    last_error = FLAG_ERR_UNKNOWN_PREREQ;
    return 0;
  }
  for (int i = 0; i < flag->prereq_count; i++) {
    if (flag->prereq_flag_ids[i] == prerequisite_flag_id) {
      last_error = FLAG_ERR_DUPLICATE_FLAG;
      return 0;
    }
  }
  if (has_path_to_flag(prerequisite_flag_id, flag_id, seen, 0)) {
    last_error = FLAG_ERR_PREREQ_CYCLE;
    return 0;
  }
  if (flag->prereq_count >= FLAG_MAX_PREREQS) {
    last_error = FLAG_ERR_CAPACITY;
    return 0;
  }
  flag->prereq_flag_ids[flag->prereq_count] = prerequisite_flag_id;
  flag->prereq_variants[flag->prereq_count] = required_variant_id;
  flag->prereq_count++;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int
flag_publish_snapshot(int snapshot_id, int flag_id, int environment_id,
                      int version, int rule_id, int segment_id, int priority,
                      int variant_id, int rollout_percent, int track_events,
                      int64_t not_before_ts, int64_t expires_ts) {
  if (!flag_by_id(flag_id)) {
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  if (snapshot_by_id(snapshot_id)) {
    last_error = FLAG_ERR_DUPLICATE_SNAPSHOT;
    return 0;
  }
  if (rollout_percent < 0 || rollout_percent > 100) {
    last_error = FLAG_ERR_BAD_ROLLOUT;
    return 0;
  }
  for (int i = 0; i < FLAG_MAX_SNAPSHOTS; i++) {
    if (!snapshots[i].used) {
      memset(&snapshots[i], 0, sizeof(Snapshot));
      snapshots[i].used = 1;
      snapshots[i].id = snapshot_id;
      snapshots[i].flag_id = flag_id;
      snapshots[i].environment_id = environment_id;
      snapshots[i].version = version;
      snapshots[i].rule_id = rule_id;
      snapshots[i].segment_id = segment_id;
      snapshots[i].priority = priority;
      snapshots[i].variant_id = variant_id;
      snapshots[i].rollout_percent = rollout_percent;
      snapshots[i].track_events = track_events;
      snapshots[i].not_before_ts = not_before_ts;
      snapshots[i].expires_ts = expires_ts;
      last_error = FLAG_OK;
      return 1;
    }
  }
  last_error = FLAG_ERR_CAPACITY;
  return 0;
}

__attribute__((visibility("default"))) int
flag_publish_tombstone(int tombstone_id, int flag_id, int environment_id,
                       int version, int64_t not_before_ts, int64_t expires_ts) {
  if (!flag_by_id(flag_id)) {
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  if (tombstone_by_id(tombstone_id)) {
    last_error = FLAG_ERR_DUPLICATE_TOMBSTONE;
    return 0;
  }
  for (int i = 0; i < FLAG_MAX_TOMBSTONES; i++) {
    if (!tombstones[i].used) {
      memset(&tombstones[i], 0, sizeof(Tombstone));
      tombstones[i].used = 1;
      tombstones[i].id = tombstone_id;
      tombstones[i].flag_id = flag_id;
      tombstones[i].environment_id = environment_id;
      tombstones[i].version = version;
      tombstones[i].not_before_ts = not_before_ts;
      tombstones[i].expires_ts = expires_ts;
      last_error = FLAG_OK;
      return 1;
    }
  }
  last_error = FLAG_ERR_CAPACITY;
  return 0;
}

__attribute__((visibility("default"))) int flag_stage_version(int flag_id,
                                                              int environment_id,
                                                              int version) {
  Binding *binding;
  if (!flag_by_id(flag_id)) {
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  binding = binding_for(flag_id, environment_id, 1);
  if (!binding) {
    last_error = FLAG_ERR_CAPACITY;
    return 0;
  }
  binding->has_staged_version = 1;
  binding->staged_version = version;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int flag_activate_version(int flag_id,
                                                                 int environment_id) {
  Binding *binding;
  if (!flag_by_id(flag_id)) {
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  binding = binding_for(flag_id, environment_id, 0);
  if (!binding || !binding->has_staged_version) {
    last_error = FLAG_ERR_UNKNOWN_BINDING;
    return 0;
  }
  binding->has_fallback_version = binding->has_active_version;
  binding->fallback_version = binding->active_version;
  binding->has_active_version = 1;
  binding->active_version = binding->staged_version;
  binding->has_staged_version = 0;
  binding->staged_version = 0;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int
flag_set_fallback_version(int flag_id, int environment_id, int version) {
  Binding *binding;
  if (!flag_by_id(flag_id)) {
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  if (!version_known(flag_id, environment_id, version)) {
    last_error = FLAG_ERR_UNKNOWN_BINDING;
    return 0;
  }
  binding = binding_for(flag_id, environment_id, 1);
  if (!binding) {
    last_error = FLAG_ERR_CAPACITY;
    return 0;
  }
  binding->has_fallback_version = 1;
  binding->fallback_version = version;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int flag_disable_snapshot(int snapshot_id) {
  Snapshot *snapshot = snapshot_by_id(snapshot_id);
  if (!snapshot) {
    last_error = FLAG_ERR_UNKNOWN_SNAPSHOT;
    return 0;
  }
  snapshot->disabled = 1;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int flag_retire_snapshot(int snapshot_id) {
  Snapshot *snapshot = snapshot_by_id(snapshot_id);
  if (!snapshot) {
    last_error = FLAG_ERR_UNKNOWN_SNAPSHOT;
    return 0;
  }
  snapshot->retired = 1;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int
flag_mark_replica_stale(int flag_id, int environment_id, int version,
                        int stale) {
  ReplicaState *state;
  if (!flag_by_id(flag_id)) {
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  state = replica_state_for(flag_id, environment_id, version, 1);
  if (!state) {
    last_error = FLAG_ERR_CAPACITY;
    return 0;
  }
  state->stale = stale ? 1 : 0;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int
flag_register_segment_membership(int subject_id, int segment_id, int member) {
  Membership *membership = membership_for(subject_id, segment_id, 1);
  if (!membership) {
    last_error = FLAG_ERR_CAPACITY;
    return 0;
  }
  membership->member = member ? 1 : 0;
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int
flag_evaluate(int flag_id, int environment_id, int subject_id,
              int subject_bucket, int64_t ts) {
  int stack[FLAG_MAX_FLAGS];
  return evaluate_flag_internal(flag_id, environment_id, subject_id,
                                subject_bucket, ts, 0, stack, 0);
}

__attribute__((visibility("default"))) int
flag_explain_get(int flag_id, int environment_id, int subject_id,
                 int subject_bucket, int64_t ts, FlagEvalView *out_view) {
  int stack[FLAG_MAX_FLAGS];
  if (!out_view) {
    last_error = FLAG_ERR_OUT;
    return 0;
  }
  if (!flag_by_id(flag_id)) {
    memset(out_view, 0, sizeof(*out_view));
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  evaluate_flag_internal(flag_id, environment_id, subject_id, subject_bucket,
                         ts, out_view, stack, 0);
  last_error = FLAG_OK;
  return 1;
}

__attribute__((visibility("default"))) int
flag_count_usable_snapshots(int flag_id, int environment_id, int64_t ts) {
  Binding *binding;
  int versions[2];
  int version_count = 0;
  int count = 0;
  if (!flag_by_id(flag_id)) {
    last_error = FLAG_ERR_UNKNOWN_FLAG;
    return 0;
  }
  binding = binding_for(flag_id, environment_id, 0);
  if (!binding) {
    last_error = FLAG_OK;
    return 0;
  }
  if (binding->has_active_version)
    versions[version_count++] = binding->active_version;
  if (binding->has_fallback_version &&
      (!binding->has_active_version ||
       binding->fallback_version != binding->active_version))
    versions[version_count++] = binding->fallback_version;
  for (int which = 0; which < version_count; which++) {
    int version = versions[which];
    if (version_replica_stale(flag_id, environment_id, version))
      continue;
    if (version_tombstoned(flag_id, environment_id, version, ts))
      continue;
    for (int i = 0; i < FLAG_MAX_SNAPSHOTS; i++) {
      Snapshot *snapshot = &snapshots[i];
      if (!snapshot->used || snapshot->flag_id != flag_id ||
          snapshot->environment_id != environment_id ||
          snapshot->version != version)
        continue;
      if (snapshot_directly_usable(snapshot, ts))
        count++;
    }
  }
  last_error = FLAG_OK;
  return count;
}

__attribute__((visibility("default"))) int flag_last_error(void) {
  return last_error;
}
}
