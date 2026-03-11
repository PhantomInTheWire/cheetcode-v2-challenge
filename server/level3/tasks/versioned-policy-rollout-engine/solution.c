#include <stdint.h>
#include <string.h>

enum {
  POLICY_MAX_SNAPSHOTS = 2048,
  POLICY_MAX_BINDINGS = 512,
  POLICY_OK = 0,
  POLICY_ERR_DUPLICATE = 1,
  POLICY_ERR_UNKNOWN_SUBJECT = 2,
  POLICY_ERR_UNKNOWN_SNAPSHOT = 3,
  POLICY_ERR_OUT = 4,
  POLICY_ERR_CAPACITY = 5
};

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

typedef struct {
  int used, id, version, subject_id, resource_id, allow_mask, deny_mask,
      priority, retired, disabled;
  int64_t not_before_ts, expires_ts;
} Snapshot;
typedef struct {
  int used, subject_id, active_version, fallback_version, staged_version;
} Binding;

static Snapshot snapshots[POLICY_MAX_SNAPSHOTS];
static Binding bindings[POLICY_MAX_BINDINGS];
static int last_error = POLICY_OK;

static Binding *binding_for(int subject_id, int create) {
  for (int i = 0; i < POLICY_MAX_BINDINGS; i++)
    if (bindings[i].used && bindings[i].subject_id == subject_id)
      return &bindings[i];
  if (!create)
    return 0;
  for (int i = 0; i < POLICY_MAX_BINDINGS; i++)
    if (!bindings[i].used) {
      memset(&bindings[i], 0, sizeof(Binding));
      bindings[i].used = 1;
      bindings[i].subject_id = subject_id;
      return &bindings[i];
    }
  return 0;
}

static Snapshot *snapshot_by_id(int snapshot_id) {
  for (int i = 0; i < POLICY_MAX_SNAPSHOTS; i++)
    if (snapshots[i].used && snapshots[i].id == snapshot_id)
      return &snapshots[i];
  return 0;
}

static int active_snapshot_flags(int subject_id, int resource_id, int version,
                                 int64_t ts, int *stale, int *disabled) {
  int matched = 0;
  *stale = 0;
  *disabled = 0;
  for (int i = 0; i < POLICY_MAX_SNAPSHOTS; i++) {
    Snapshot *s = &snapshots[i];
    if (!s->used || s->subject_id != subject_id ||
        s->resource_id != resource_id || s->version != version)
      continue;
    matched = 1;
    if (s->retired || s->disabled)
      *disabled = 1;
    else if (ts < s->not_before_ts || ts >= s->expires_ts)
      *stale = 1;
  }
  return matched;
}

static Snapshot *best_snapshot(int subject_id, int resource_id, int version,
                               int64_t ts) {
  Snapshot *best = 0;
  for (int i = 0; i < POLICY_MAX_SNAPSHOTS; i++) {
    Snapshot *s = &snapshots[i];
    if (!s->used || s->subject_id != subject_id ||
        s->resource_id != resource_id || s->version != version)
      continue;
    if (s->retired || s->disabled || ts < s->not_before_ts ||
        ts >= s->expires_ts)
      continue;
    if (!best || s->priority > best->priority ||
        (s->priority == best->priority && s->id > best->id))
      best = s;
  }
  return best;
}

__attribute__((visibility("default"))) void policy_reset(void) {
  memset(snapshots, 0, sizeof(snapshots));
  memset(bindings, 0, sizeof(bindings));
  last_error = POLICY_OK;
}
__attribute__((visibility("default"))) int
policy_publish_snapshot(int snapshot_id, int version, int subject_id,
                        int resource_id, int allow_mask, int deny_mask,
                        int priority, int64_t not_before_ts,
                        int64_t expires_ts) {
  if (snapshot_by_id(snapshot_id)) {
    last_error = POLICY_ERR_DUPLICATE;
    return 0;
  }
  for (int i = 0; i < POLICY_MAX_SNAPSHOTS; i++)
    if (!snapshots[i].used) {
      snapshots[i].used = 1;
      snapshots[i].id = snapshot_id;
      snapshots[i].version = version;
      snapshots[i].subject_id = subject_id;
      snapshots[i].resource_id = resource_id;
      snapshots[i].allow_mask = allow_mask;
      snapshots[i].deny_mask = deny_mask;
      snapshots[i].priority = priority;
      snapshots[i].not_before_ts = not_before_ts;
      snapshots[i].expires_ts = expires_ts;
      last_error = POLICY_OK;
      return 1;
    }
  last_error = POLICY_ERR_CAPACITY;
  return 0;
}
__attribute__((visibility("default"))) int
policy_set_subject_binding(int subject_id, int active_version,
                           int fallback_version) {
  Binding *b = binding_for(subject_id, 1);
  if (!b) {
    last_error = POLICY_ERR_CAPACITY;
    return 0;
  }
  b->active_version = active_version;
  b->fallback_version = fallback_version;
  last_error = POLICY_OK;
  return 1;
}
__attribute__((visibility("default"))) int
policy_stage_version(int subject_id, int staged_version) {
  Binding *b = binding_for(subject_id, 0);
  if (!b) {
    last_error = POLICY_ERR_UNKNOWN_SUBJECT;
    return 0;
  }
  b->staged_version = staged_version;
  last_error = POLICY_OK;
  return 1;
}
__attribute__((visibility("default"))) int
policy_activate_version(int subject_id) {
  Binding *b = binding_for(subject_id, 0);
  if (!b || b->staged_version == 0) {
    last_error = POLICY_ERR_UNKNOWN_SUBJECT;
    return 0;
  }
  b->fallback_version = b->active_version;
  b->active_version = b->staged_version;
  b->staged_version = 0;
  last_error = POLICY_OK;
  return 1;
}
__attribute__((visibility("default"))) int
policy_retire_snapshot(int snapshot_id) {
  Snapshot *s = snapshot_by_id(snapshot_id);
  if (!s) {
    last_error = POLICY_ERR_UNKNOWN_SNAPSHOT;
    return 0;
  }
  s->retired = 1;
  last_error = POLICY_OK;
  return 1;
}
__attribute__((visibility("default"))) int
policy_disable_snapshot(int snapshot_id) {
  Snapshot *s = snapshot_by_id(snapshot_id);
  if (!s) {
    last_error = POLICY_ERR_UNKNOWN_SNAPSHOT;
    return 0;
  }
  s->disabled = 1;
  last_error = POLICY_OK;
  return 1;
}
__attribute__((visibility("default"))) int
policy_check(int subject_id, int resource_id, int perm_bit, int64_t ts) {
  Binding *b = binding_for(subject_id, 0);
  Snapshot *s;
  if (!b)
    return 0;
  s = best_snapshot(subject_id, resource_id, b->active_version, ts);
  if (!s && b->fallback_version)
    s = best_snapshot(subject_id, resource_id, b->fallback_version, ts);
  if (!s)
    return 0;
  if (s->deny_mask & perm_bit)
    return 0;
  return (s->allow_mask & perm_bit) ? 1 : 0;
}
__attribute__((visibility("default"))) int
policy_explain_get(int subject_id, int resource_id, int perm_bit, int64_t ts,
                   PolicyExplainView *out_view) {
  Binding *b = binding_for(subject_id, 0);
  Snapshot *s = 0;
  int stale = 0, disabled = 0;
  (void)perm_bit;
  if (!out_view) {
    last_error = POLICY_ERR_OUT;
    return 0;
  }
  memset(out_view, 0, sizeof(*out_view));
  if (!b)
    return 0;
  out_view->exists = 1;
  active_snapshot_flags(subject_id, resource_id, b->active_version, ts, &stale,
                        &disabled);
  s = best_snapshot(subject_id, resource_id, b->active_version, ts);
  if (s)
    out_view->decided_version = b->active_version;
  if (!s && b->fallback_version) {
    s = best_snapshot(subject_id, resource_id, b->fallback_version, ts);
    if (s) {
      out_view->decided_version = b->fallback_version;
      out_view->fallback_used = 1;
    }
  }
  out_view->stale_snapshot = stale;
  out_view->disabled_snapshot = disabled;
  if (!s)
    return 1;
  out_view->matched_snapshot_id = s->id;
  out_view->allow_mask = s->allow_mask;
  out_view->deny_mask = s->deny_mask;
  out_view->usable =
      ((s->allow_mask & perm_bit) && !(s->deny_mask & perm_bit)) ? 1 : 0;
  return 1;
}
__attribute__((visibility("default"))) int
policy_count_subject_rules(int subject_id, int64_t ts) {
  Binding *b = binding_for(subject_id, 0);
  int count = 0;
  if (!b)
    return 0;
  for (int i = 0; i < POLICY_MAX_SNAPSHOTS; i++) {
    Snapshot *s = &snapshots[i];
    if (!s->used || s->subject_id != subject_id || s->retired || s->disabled ||
        ts < s->not_before_ts || ts >= s->expires_ts)
      continue;
    if (s->version == b->active_version || s->version == b->fallback_version)
      count++;
  }
  return count;
}
__attribute__((visibility("default"))) int policy_last_error(void) {
  return last_error;
}
