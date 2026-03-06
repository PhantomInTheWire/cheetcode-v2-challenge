#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct AuthAuditView {
  int exists;
  int source;
  int stored_mask;
  int effective_mask;
  int revoked;
  int requires_key;
  int key_attached;
  int not_yet_valid;
  int expired;
  int disabled_by_ancestor;
  int usable;
} AuthAuditView;

void auth_reset(void);
int auth_create_local_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable
);
int auth_import_bundle_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable,
  int requires_key
);
int auth_attach_bundle_key(int grant_id);
int auth_delegate(
  int parent_grant_id,
  int child_grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable,
  int requires_key
);
int auth_revoke(int grant_id);
int auth_check(int subject_id, int resource_id, int perm_bit, int64_t ts, int resolve_mode);
int auth_effective_mask(int grant_id, int64_t ts);
int auth_audit_get(int grant_id, int64_t ts, AuthAuditView* out_view);
int auth_count_usable(int subject_id, int64_t ts, int resolve_mode);
int auth_last_error(void);

#ifdef __cplusplus
}
#endif

enum {
  AUTH_PERM_READ = 1,
  AUTH_PERM_WRITE = 2,
  AUTH_PERM_ADMIN = 4,
  AUTH_SOURCE_LOCAL_PROFILE = 1,
  AUTH_SOURCE_IDENTITY_BUNDLE = 2,
  AUTH_MODE_LOCAL_ONLY = 1,
  AUTH_MODE_BUNDLE_ONLY = 2,
  AUTH_MODE_AUTO = 3,
  AUTH_OK = 0,
  AUTH_ERR_DUPLICATE_ID = 1,
  AUTH_ERR_UNKNOWN_GRANT = 2,
  AUTH_ERR_WRONG_SOURCE = 3,
  AUTH_ERR_PARENT_NOT_DELEGATABLE = 4,
  AUTH_ERR_CHILD_MASK_WIDENS = 5,
  AUTH_ERR_CHILD_START_TOO_EARLY = 6,
  AUTH_ERR_CHILD_EXPIRES_TOO_LATE = 7,
  AUTH_ERR_OUT_PARAM = 8,
  AUTH_ERR_CAPACITY = 9,
  AUTH_ERR_PARENT_REVOKED = 10,
  REF_MAX_GRANTS = 2048,
  HOT_ID_CAP = 2048,
  LEAF_ID_CAP = 512,
  WORLD_LOCAL_HEAVY = 1,
  WORLD_BUNDLE_HEAVY = 2,
  WORLD_MIXED = 3,
  WORLD_AUTO_ALL_BUNDLE = 4,
};

typedef struct {
  int ok;
  char msg[256];
} Check;

typedef struct {
  int used;
  int id;
  int parent_index;
  int subject_id;
  int resource_id;
  int source;
  int stored_mask;
  int delegatable;
  int requires_key;
  int key_attached;
  int revoked;
  int64_t not_before_ts;
  int64_t expires_ts;
} RefGrant;

static RefGrant ref_grants[REF_MAX_GRANTS];
static int ref_last_error = AUTH_OK;
static int hot_ids[HOT_ID_CAP];
static int hot_id_count = 0;
static int leaf_ids[LEAF_ID_CAP];
static int leaf_id_count = 0;

static void check_set(Check* check, int ok, const char* msg) {
  check->ok = ok ? 1 : 0;
  snprintf(check->msg, sizeof(check->msg), "%s", msg);
}

static void print_check(const char* key, const Check* check) {
  printf("%s|%d|%s\n", key, check->ok ? 1 : 0, check->msg);
}

static int normalize_mask(int mask) {
  return mask & (AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN);
}

static void ref_set_error(int code) {
  ref_last_error = code;
}

static void ref_reset(void) {
  memset(ref_grants, 0, sizeof(ref_grants));
  ref_last_error = AUTH_OK;
}

static int ref_find_index(int grant_id) {
  for (int i = 0; i < REF_MAX_GRANTS; i++) {
    if (ref_grants[i].used && ref_grants[i].id == grant_id) return i;
  }
  return -1;
}

static int ref_alloc_index(void) {
  for (int i = 0; i < REF_MAX_GRANTS; i++) {
    if (!ref_grants[i].used) return i;
  }
  return -1;
}

static int ref_key_attached_value(const RefGrant* grant) {
  if (grant->source != AUTH_SOURCE_IDENTITY_BUNDLE) return 1;
  if (!grant->requires_key) return 1;
  return grant->key_attached ? 1 : 0;
}

static int ref_self_usable(const RefGrant* grant, int64_t ts) {
  if (!grant->used || grant->revoked) return 0;
  if (ts < grant->not_before_ts) return 0;
  if (ts >= grant->expires_ts) return 0;
  return ref_key_attached_value(grant);
}

static int ref_effective_mask(int index, int64_t ts) {
  int mask = AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN;
  int current = index;
  while (current >= 0) {
    const RefGrant* grant = &ref_grants[current];
    if (!ref_self_usable(grant, ts)) return 0;
    mask &= normalize_mask(grant->stored_mask);
    current = grant->parent_index;
  }
  return mask;
}

static int ref_disabled_by_ancestor(int index, int64_t ts) {
  int parent = ref_grants[index].parent_index;
  while (parent >= 0) {
    const RefGrant* grant = &ref_grants[parent];
    if (!ref_self_usable(grant, ts)) return 1;
    parent = grant->parent_index;
  }
  return 0;
}

static int ref_select_source(int subject_id, int resolve_mode) {
  if (resolve_mode == AUTH_MODE_LOCAL_ONLY) return AUTH_SOURCE_LOCAL_PROFILE;
  if (resolve_mode == AUTH_MODE_BUNDLE_ONLY) return AUTH_SOURCE_IDENTITY_BUNDLE;
  for (int i = 0; i < REF_MAX_GRANTS; i++) {
    if (
      ref_grants[i].used &&
      ref_grants[i].subject_id == subject_id &&
      ref_grants[i].source == AUTH_SOURCE_IDENTITY_BUNDLE
    ) {
      return AUTH_SOURCE_IDENTITY_BUNDLE;
    }
  }
  return AUTH_SOURCE_LOCAL_PROFILE;
}

static void ref_write_grant(
  int index,
  int grant_id,
  int parent_index,
  int subject_id,
  int resource_id,
  int source,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable,
  int requires_key
) {
  ref_grants[index].used = 1;
  ref_grants[index].id = grant_id;
  ref_grants[index].parent_index = parent_index;
  ref_grants[index].subject_id = subject_id;
  ref_grants[index].resource_id = resource_id;
  ref_grants[index].source = source;
  ref_grants[index].stored_mask = normalize_mask(perms_mask);
  ref_grants[index].delegatable = delegatable ? 1 : 0;
  ref_grants[index].requires_key =
    source == AUTH_SOURCE_IDENTITY_BUNDLE && requires_key ? 1 : 0;
  ref_grants[index].key_attached = ref_grants[index].requires_key ? 0 : 1;
  ref_grants[index].revoked = 0;
  ref_grants[index].not_before_ts = not_before_ts;
  ref_grants[index].expires_ts = expires_ts;
}

static int ref_create_local_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable
) {
  int index;
  if (ref_find_index(grant_id) >= 0) {
    ref_set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  index = ref_alloc_index();
  if (index < 0) {
    ref_set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  ref_write_grant(
    index,
    grant_id,
    -1,
    subject_id,
    resource_id,
    AUTH_SOURCE_LOCAL_PROFILE,
    perms_mask,
    not_before_ts,
    expires_ts,
    delegatable,
    0
  );
  ref_set_error(AUTH_OK);
  return 1;
}

static int ref_import_bundle_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable,
  int requires_key
) {
  int index;
  if (ref_find_index(grant_id) >= 0) {
    ref_set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  index = ref_alloc_index();
  if (index < 0) {
    ref_set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  ref_write_grant(
    index,
    grant_id,
    -1,
    subject_id,
    resource_id,
    AUTH_SOURCE_IDENTITY_BUNDLE,
    perms_mask,
    not_before_ts,
    expires_ts,
    delegatable,
    requires_key
  );
  ref_set_error(AUTH_OK);
  return 1;
}

static int ref_attach_bundle_key(int grant_id) {
  int index = ref_find_index(grant_id);
  if (index < 0) {
    ref_set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  if (ref_grants[index].source != AUTH_SOURCE_IDENTITY_BUNDLE) {
    ref_set_error(AUTH_ERR_WRONG_SOURCE);
    return 0;
  }
  ref_grants[index].key_attached = 1;
  ref_set_error(AUTH_OK);
  return 1;
}

static int ref_delegate(
  int parent_grant_id,
  int child_grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable,
  int requires_key
) {
  int parent_index;
  int child_index;
  RefGrant* parent;
  if (ref_find_index(child_grant_id) >= 0) {
    ref_set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  parent_index = ref_find_index(parent_grant_id);
  if (parent_index < 0) {
    ref_set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  parent = &ref_grants[parent_index];
  if (parent->revoked) {
    ref_set_error(AUTH_ERR_PARENT_REVOKED);
    return 0;
  }
  if (!parent->delegatable) {
    ref_set_error(AUTH_ERR_PARENT_NOT_DELEGATABLE);
    return 0;
  }
  if (not_before_ts < parent->not_before_ts) {
    ref_set_error(AUTH_ERR_CHILD_START_TOO_EARLY);
    return 0;
  }
  if (expires_ts > parent->expires_ts) {
    ref_set_error(AUTH_ERR_CHILD_EXPIRES_TOO_LATE);
    return 0;
  }
  if ((normalize_mask(perms_mask) & ~normalize_mask(parent->stored_mask)) != 0) {
    ref_set_error(AUTH_ERR_CHILD_MASK_WIDENS);
    return 0;
  }
  child_index = ref_alloc_index();
  if (child_index < 0) {
    ref_set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  ref_write_grant(
    child_index,
    child_grant_id,
    parent_index,
    subject_id,
    resource_id,
    parent->source,
    perms_mask,
    not_before_ts,
    expires_ts,
    delegatable,
    parent->source == AUTH_SOURCE_IDENTITY_BUNDLE ? requires_key : 0
  );
  ref_set_error(AUTH_OK);
  return 1;
}

static int ref_revoke(int grant_id) {
  int index = ref_find_index(grant_id);
  if (index < 0) {
    ref_set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  ref_grants[index].revoked = 1;
  ref_set_error(AUTH_OK);
  return 1;
}

static int ref_check(int subject_id, int resource_id, int perm_bit, int64_t ts, int resolve_mode) {
  int source = ref_select_source(subject_id, resolve_mode);
  int requested = normalize_mask(perm_bit);
  for (int i = 0; i < REF_MAX_GRANTS; i++) {
    if (
      ref_grants[i].used &&
      ref_grants[i].subject_id == subject_id &&
      ref_grants[i].resource_id == resource_id &&
      ref_grants[i].source == source &&
      requested != 0 &&
      (ref_effective_mask(i, ts) & requested) == requested
    ) {
      ref_set_error(AUTH_OK);
      return 1;
    }
  }
  ref_set_error(AUTH_OK);
  return 0;
}

static int ref_effective_mask_lookup(int grant_id, int64_t ts) {
  int index = ref_find_index(grant_id);
  if (index < 0) {
    ref_set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  ref_set_error(AUTH_OK);
  return ref_effective_mask(index, ts);
}

static int ref_audit_get(int grant_id, int64_t ts, AuthAuditView* out_view) {
  int index;
  RefGrant* grant;
  if (!out_view) {
    ref_set_error(AUTH_ERR_OUT_PARAM);
    return 0;
  }
  index = ref_find_index(grant_id);
  if (index < 0) {
    ref_set_error(AUTH_ERR_UNKNOWN_GRANT);
    memset(out_view, 0, sizeof(*out_view));
    return 0;
  }
  grant = &ref_grants[index];
  out_view->exists = 1;
  out_view->source = grant->source;
  out_view->stored_mask = normalize_mask(grant->stored_mask);
  out_view->effective_mask = ref_effective_mask(index, ts);
  out_view->revoked = grant->revoked ? 1 : 0;
  out_view->requires_key = grant->source == AUTH_SOURCE_IDENTITY_BUNDLE && grant->requires_key ? 1 : 0;
  out_view->key_attached = ref_key_attached_value(grant);
  out_view->not_yet_valid = ts < grant->not_before_ts ? 1 : 0;
  out_view->expired = ts >= grant->expires_ts ? 1 : 0;
  out_view->disabled_by_ancestor = ref_disabled_by_ancestor(index, ts);
  out_view->usable = out_view->effective_mask != 0 ? 1 : 0;
  ref_set_error(AUTH_OK);
  return 1;
}

static int ref_count_usable(int subject_id, int64_t ts, int resolve_mode) {
  int source = ref_select_source(subject_id, resolve_mode);
  int count = 0;
  for (int i = 0; i < REF_MAX_GRANTS; i++) {
    if (
      ref_grants[i].used &&
      ref_grants[i].subject_id == subject_id &&
      ref_grants[i].source == source &&
      ref_effective_mask(i, ts) != 0
    ) {
      count++;
    }
  }
  ref_set_error(AUTH_OK);
  return count;
}

static int view_equal(const AuthAuditView* a, const AuthAuditView* b) {
  return a->exists == b->exists &&
    a->source == b->source &&
    a->stored_mask == b->stored_mask &&
    a->effective_mask == b->effective_mask &&
    a->revoked == b->revoked &&
    a->requires_key == b->requires_key &&
    a->key_attached == b->key_attached &&
    a->not_yet_valid == b->not_yet_valid &&
    a->expired == b->expired &&
    a->disabled_by_ancestor == b->disabled_by_ancestor &&
    a->usable == b->usable;
}

static uint32_t lcg_next(uint32_t* state) {
  *state = (*state * 1664525u) + 1013904223u;
  return *state;
}

static void reset_tracks(void) {
  hot_id_count = 0;
  leaf_id_count = 0;
}

static void track_hot_id(int id) {
  if (hot_id_count < HOT_ID_CAP) hot_ids[hot_id_count++] = id;
}

static void track_leaf_id(int id) {
  if (leaf_id_count < LEAF_ID_CAP) leaf_ids[leaf_id_count++] = id;
}

static double measure_read_workload(int (*workload)(int), int iterations, int* checksum) {
  clock_t start_clock;
  clock_t end_clock;
  workload(512);
  start_clock = clock();
  *checksum = workload(iterations);
  end_clock = clock();
  return (double)(end_clock - start_clock) / (double)CLOCKS_PER_SEC;
}

static void set_ratio_result(
  Check* check,
  const char* label,
  double baseline,
  double inflated,
  double max_ratio,
  int baseline_sum,
  int inflated_sum
) {
  double denom = baseline > 0.000001 ? baseline : 0.000001;
  double ratio = inflated / denom;
  int ok = baseline_sum == inflated_sum && ratio <= max_ratio;
  snprintf(
    check->msg,
    sizeof(check->msg),
    "%s baseline=%.4fs inflated=%.4fs ratio=%.2fx<=%.2fx sum=%d/%d",
    label,
    baseline,
    inflated,
    ratio,
    max_ratio,
    baseline_sum,
    inflated_sum
  );
  check->ok = ok ? 1 : 0;
}

static void set_budget_result(
  Check* check,
  const char* label,
  double elapsed,
  double budget,
  int checksum
) {
  snprintf(
    check->msg,
    sizeof(check->msg),
    "%s elapsed=%.4fs<=%.4fs sum=%d",
    label,
    elapsed,
    budget,
    checksum
  );
  check->ok = elapsed <= budget ? 1 : 0;
}

static void seed_lookup_world(int cold_noise_grants) {
  int next_id = 5000;
  reset_tracks();
  auth_reset();
  for (int subject = 0; subject < 16; subject++) {
    for (int resource = 0; resource < 4; resource++) {
      int local_id = next_id++;
      int bundle_id = next_id++;
      auth_create_local_grant(local_id, subject, resource, AUTH_PERM_READ | AUTH_PERM_WRITE, 0, 200, 0);
      auth_import_bundle_grant(bundle_id, subject, resource, AUTH_PERM_READ, 0, 200, 0, (subject + resource) % 3 == 0);
      if ((subject + resource) % 3 != 0) auth_attach_bundle_key(bundle_id);
      track_hot_id(local_id);
      track_hot_id(bundle_id);
    }
  }
  for (int i = 0; i < cold_noise_grants; i++) {
    int subject = 1000 + (i / 8);
    int resource = 200 + (i % 8);
    if (i & 1) {
      auth_import_bundle_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0, 0);
    } else {
      auth_create_local_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0);
    }
  }
}

static void seed_auth_world(int world_kind, int same_subject_noise_per_subject, int cold_noise_grants) {
  int next_id = 1000;
  reset_tracks();
  auth_reset();
  for (int subject = 0; subject < 16; subject++) {
    for (int resource = 0; resource < 4; resource++) {
      int local_id = next_id++;
      int selected_id = local_id;
      int use_bundle =
        world_kind == WORLD_BUNDLE_HEAVY ||
        world_kind == WORLD_AUTO_ALL_BUNDLE ||
        (world_kind == WORLD_MIXED && (subject % 2 == 0));
      auth_create_local_grant(
        local_id,
        subject,
        resource,
        AUTH_PERM_READ | AUTH_PERM_WRITE,
        0,
        200,
        1
      );
      if (use_bundle) {
        int bundle_id = next_id++;
        auth_import_bundle_grant(bundle_id, subject, resource, AUTH_PERM_READ, 0, 200, 1, 0);
        selected_id = bundle_id;
      }
      track_hot_id(selected_id);
    }
    for (int extra = 0; extra < same_subject_noise_per_subject; extra++) {
      int resource = 100 + extra;
      int use_bundle =
        world_kind == WORLD_BUNDLE_HEAVY ||
        world_kind == WORLD_AUTO_ALL_BUNDLE ||
        (world_kind == WORLD_MIXED && (subject % 2 == 0));
      if (use_bundle) {
        auth_import_bundle_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0, 0);
      } else {
        auth_create_local_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0);
      }
    }
  }
  for (int i = 0; i < cold_noise_grants; i++) {
    int subject = 1000 + (i / 8);
    int resource = 300 + (i % 8);
    if (i & 1) {
      auth_import_bundle_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0, 0);
    } else {
      auth_create_local_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0);
    }
  }
}

static void seed_count_world(int mixed_mode, int cold_noise_grants) {
  int next_id = 9000;
  reset_tracks();
  auth_reset();
  for (int subject = 0; subject < 12; subject++) {
    for (int resource = 0; resource < 16; resource++) {
      int local_id = next_id++;
      auth_create_local_grant(local_id, subject, resource, AUTH_PERM_READ, 0, 200, 0);
      track_hot_id(local_id);
      if (mixed_mode && (subject % 2 == 0) && (resource % 2 == 0)) {
        int bundle_id = next_id++;
        auth_import_bundle_grant(bundle_id, subject, resource, AUTH_PERM_READ, 0, 200, 0, 0);
        track_hot_id(bundle_id);
      }
    }
  }
  for (int i = 0; i < cold_noise_grants; i++) {
    int subject = 2000 + (i / 8);
    int resource = 400 + (i % 8);
    if (i & 1) {
      auth_import_bundle_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0, 0);
    } else {
      auth_create_local_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0);
    }
  }
}

static void seed_deep_chain_world(int cold_noise_grants) {
  int next_id = 13000;
  reset_tracks();
  auth_reset();
  for (int subject = 0; subject < 16; subject++) {
    for (int resource = 0; resource < 2; resource++) {
      int parent = next_id++;
      auth_create_local_grant(parent, subject, resource, AUTH_PERM_READ, 0, 200, 1);
      for (int depth = 1; depth < 8; depth++) {
        int child = next_id++;
        auth_delegate(parent, child, subject, resource, AUTH_PERM_READ, 0, 200, depth < 7, 0);
        parent = child;
      }
      track_hot_id(parent);
      track_leaf_id(parent);
    }
  }
  for (int i = 0; i < cold_noise_grants; i++) {
    int subject = 3000 + (i / 8);
    int resource = 500 + (i % 8);
    if (i & 1) {
      auth_import_bundle_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0, 0);
    } else {
      auth_create_local_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 200, 0);
    }
  }
}

static void seed_large_world(int cold_noise_grants) {
  int next_id = 20000;
  reset_tracks();
  auth_reset();
  for (int subject = 0; subject < 32; subject++) {
    for (int resource = 0; resource < 8; resource++) {
      int root_local = next_id++;
      int child_local = next_id++;
      int extra_a = next_id++;
      int extra_b = next_id++;
      auth_create_local_grant(root_local, subject, resource, AUTH_PERM_READ | AUTH_PERM_WRITE, 0, 400, 1);
      auth_delegate(root_local, child_local, subject, resource, AUTH_PERM_READ, 0, 400, 0, 0);
      if (subject % 2 == 0) {
        auth_import_bundle_grant(extra_a, subject, resource, AUTH_PERM_READ, 0, 400, 1, 0);
        auth_delegate(extra_a, extra_b, subject, resource, AUTH_PERM_READ, 0, 400, 0, 0);
      } else {
        auth_create_local_grant(extra_a, subject, resource, AUTH_PERM_READ, 0, 400, 0);
        auth_create_local_grant(extra_b, subject, resource, AUTH_PERM_READ, 0, 400, 0);
      }
      track_hot_id(root_local);
      track_hot_id(child_local);
      track_hot_id(extra_a);
      track_hot_id(extra_b);
    }
  }
  for (int i = 0; i < cold_noise_grants; i++) {
    int subject = 4000 + (i / 8);
    int resource = 600 + (i % 8);
    if (i & 1) {
      auth_import_bundle_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 400, 0, 0);
    } else {
      auth_create_local_grant(next_id++, subject, resource, AUTH_PERM_READ, 0, 400, 0);
    }
  }
}

static int workload_grant_id_lookup_ratio(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    int id;
    if ((i & 1) == 0) {
      id = hot_ids[i % hot_id_count];
      sum += auth_effective_mask(id, 50);
    } else {
      id = 900000 + (i % 97);
      sum += auth_effective_mask(id, 50);
      sum += auth_last_error() == AUTH_ERR_UNKNOWN_GRANT ? 1 : 0;
    }
  }
  return sum;
}

static int workload_audit_lookup_ratio(int iterations) {
  int sum = 0;
  AuthAuditView view;
  for (int i = 0; i < iterations; i++) {
    if (auth_audit_get(hot_ids[i % hot_id_count], 50, &view) == 1) {
      sum += view.exists + view.usable + view.effective_mask;
    }
  }
  return sum;
}

static int workload_effective_mask_lookup_ratio(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    sum += auth_effective_mask(hot_ids[i % hot_id_count], 50);
  }
  return sum;
}

static int workload_auto_hot_auth(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 16;
    int resource = (i / 16) % 4;
    sum += auth_check(subject, resource, AUTH_PERM_READ, 50, AUTH_MODE_AUTO);
  }
  return sum;
}

static int workload_local_hot_auth(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 16;
    int resource = (i / 16) % 4;
    sum += auth_check(subject, resource, AUTH_PERM_READ, 50, AUTH_MODE_AUTO);
  }
  return sum;
}

static int workload_bundle_hot_auth(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 16;
    int resource = (i / 16) % 4;
    sum += auth_check(subject, resource, AUTH_PERM_READ, 50, AUTH_MODE_AUTO);
  }
  return sum;
}

static int workload_count_hot_subject(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 12;
    sum += auth_count_usable(subject, 50, AUTH_MODE_LOCAL_ONLY);
  }
  return sum;
}

static int workload_count_mode_mix(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 12;
    int mode = 1 + (i % 3);
    sum += auth_count_usable(subject, 50, mode);
  }
  return sum;
}

static int workload_mixed_read_loop(int iterations) {
  int sum = 0;
  AuthAuditView view;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 16;
    int resource = (i / 16) % 4;
    int id = hot_ids[i % hot_id_count];
    sum += auth_check(subject, resource, AUTH_PERM_READ, 50, AUTH_MODE_AUTO);
    sum += auth_count_usable(subject % 12, 50, 1 + (i % 3));
    sum += auth_effective_mask(id, 50);
    if (auth_audit_get(id, 50, &view) == 1) {
      sum += view.usable + view.effective_mask;
    }
  }
  return sum;
}

static int workload_deep_chain_hot_read(int iterations) {
  int sum = 0;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 16;
    int resource = (i / 16) % 2;
    int leaf = leaf_ids[i % leaf_id_count];
    sum += auth_effective_mask(leaf, 50);
    sum += auth_check(subject, resource, AUTH_PERM_READ, 50, AUTH_MODE_LOCAL_ONLY);
  }
  return sum;
}

static int workload_large_reads(int iterations) {
  int sum = 0;
  AuthAuditView view;
  for (int i = 0; i < iterations; i++) {
    int subject = i % 32;
    int resource = (i / 32) % 8;
    int id = hot_ids[i % hot_id_count];
    switch (i % 4) {
      case 0:
        sum += auth_check(subject, resource, AUTH_PERM_READ, 50, AUTH_MODE_AUTO);
        break;
      case 1:
        sum += auth_count_usable(subject, 50, AUTH_MODE_AUTO);
        break;
      case 2:
        sum += auth_effective_mask(id, 50);
        break;
      default:
        if (auth_audit_get(id, 50, &view) == 1) {
          sum += view.exists + view.usable + view.effective_mask;
        }
        break;
    }
  }
  return sum;
}

int main(void) {
  Check behavior_source_resolution = {0, ""};
  Check behavior_time_and_perm_contract = {0, ""};
  Check behavior_delegation_and_ancestors = {0, ""};
  Check behavior_audit_count_error_contract = {0, ""};
  Check update_revoke_read_consistency = {0, ""};
  Check update_key_attach_read_consistency = {0, ""};
  Check update_independent_chain_isolation = {0, ""};
  Check update_small_trace_equivalence = {0, ""};
  Check scale_grant_id_lookup_ratio = {0, ""};
  Check scale_audit_lookup_ratio = {0, ""};
  Check scale_effective_mask_lookup_ratio = {0, ""};
  Check scale_auto_bundle_presence_other_subject_noise = {0, ""};
  Check scale_auto_bundle_presence_same_subject_noise = {0, ""};
  Check scale_hot_auth_lookup_ratio = {0, ""};
  Check scale_same_subject_irrelevant_resource_ratio = {0, ""};
  Check scale_other_subject_noise_ratio = {0, ""};
  Check scale_count_usable_hot_subject_ratio = {0, ""};
  Check scale_count_usable_mode_mix_ratio = {0, ""};
  Check scale_mixed_read_loop_ratio = {0, ""};
  Check scale_deep_chain_hot_read_ratio = {0, ""};
  Check scale_bundle_heavy_hotset_ratio = {0, ""};
  Check scale_local_heavy_hotset_ratio = {0, ""};
  Check scale_mixed_source_hotset_ratio = {0, ""};
  Check scale_large_read_budget = {0, ""};
  Check scale_large_trace_equivalence_budget = {0, ""};

  auth_reset();
  if (
    auth_create_local_grant(1, 1, 100, AUTH_PERM_WRITE, 0, 40, 0) == 1 &&
    auth_import_bundle_grant(2, 1, 100, AUTH_PERM_READ, 0, 40, 0, 1) == 1 &&
    auth_attach_bundle_key(2) == 1 &&
    auth_check(1, 100, AUTH_PERM_READ, 10, AUTH_MODE_AUTO) == 1 &&
    auth_check(1, 100, AUTH_PERM_WRITE, 10, AUTH_MODE_AUTO) == 0 &&
    auth_check(1, 100, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 0 &&
    auth_check(1, 100, AUTH_PERM_WRITE, 10, AUTH_MODE_LOCAL_ONLY) == 1 &&
    auth_check(1, 100, AUTH_PERM_READ, 10, AUTH_MODE_BUNDLE_ONLY) == 1
  ) {
    auth_reset();
    if (
      auth_create_local_grant(3, 2, 101, AUTH_PERM_READ, 0, 40, 0) == 1 &&
      auth_import_bundle_grant(4, 2, 101, AUTH_PERM_READ, 0, 40, 0, 1) == 1 &&
      auth_check(2, 101, AUTH_PERM_READ, 10, AUTH_MODE_AUTO) == 0 &&
      auth_check(2, 101, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 1
    ) {
      check_set(&behavior_source_resolution, 1, "source precedence and mode isolation hold");
    } else {
      check_set(&behavior_source_resolution, 0, "AUTO fallback or mode isolation failed");
    }
  } else {
    check_set(&behavior_source_resolution, 0, "source resolution fixture failed");
  }

  auth_reset();
  if (
    auth_create_local_grant(10, 3, 102, AUTH_PERM_ADMIN, 10, 20, 0) == 1 &&
    auth_check(3, 102, AUTH_PERM_ADMIN, 10, AUTH_MODE_LOCAL_ONLY) == 1 &&
    auth_check(3, 102, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 0 &&
    auth_check(3, 102, AUTH_PERM_ADMIN, 20, AUTH_MODE_LOCAL_ONLY) == 0
  ) {
    auth_reset();
    if (
      auth_create_local_grant(11, 3, 102, AUTH_PERM_READ, 10, 20, 0) == 1 &&
      auth_check(3, 102, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 1 &&
      auth_check(3, 102, AUTH_PERM_READ, 9, AUTH_MODE_LOCAL_ONLY) == 0
    ) {
      check_set(&behavior_time_and_perm_contract, 1, "time boundaries and ADMIN contract hold");
    } else {
      check_set(&behavior_time_and_perm_contract, 0, "time boundary behavior failed");
    }
  } else {
    check_set(&behavior_time_and_perm_contract, 0, "ADMIN contract failed");
  }

  auth_reset();
  if (
    auth_create_local_grant(20, 4, 103, AUTH_PERM_READ, 0, 40, 1) == 1 &&
    auth_delegate(20, 21, 4, 103, AUTH_PERM_READ, 0, 40, 1, 0) == 1 &&
    auth_revoke(20) == 1 &&
    auth_check(4, 103, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 0
  ) {
    auth_reset();
    if (
      auth_import_bundle_grant(22, 5, 104, AUTH_PERM_READ, 0, 40, 1, 1) == 1 &&
      auth_delegate(22, 23, 5, 104, AUTH_PERM_READ, 0, 40, 0, 1) == 1 &&
      auth_attach_bundle_key(23) == 1 &&
      auth_check(5, 104, AUTH_PERM_READ, 10, AUTH_MODE_BUNDLE_ONLY) == 0 &&
      auth_delegate(22, 24, 5, 104, AUTH_PERM_READ | AUTH_PERM_WRITE, 0, 40, 0, 0) == 0 &&
      auth_last_error() == AUTH_ERR_CHILD_MASK_WIDENS
    ) {
      check_set(&behavior_delegation_and_ancestors, 1, "delegation bounds and ancestor disablement hold");
    } else {
      check_set(&behavior_delegation_and_ancestors, 0, "delegation or ancestor rules failed");
    }
  } else {
    check_set(&behavior_delegation_and_ancestors, 0, "revoke propagation failed");
  }

  auth_reset();
  {
    AuthAuditView view;
    if (
      auth_create_local_grant(30, 6, 105, AUTH_PERM_READ, 0, 40, 0) == 1 &&
      auth_attach_bundle_key(30) == 0 &&
      auth_last_error() == AUTH_ERR_WRONG_SOURCE
    ) {
      auth_reset();
      if (
        auth_import_bundle_grant(31, 6, 105, AUTH_PERM_READ, 0, 40, 0, 1) == 1 &&
        auth_audit_get(31, 10, &view) == 1 &&
        view.exists == 1 &&
        view.requires_key == 1 &&
        view.key_attached == 0 &&
        view.usable == 0 &&
        auth_create_local_grant(32, 6, 105, AUTH_PERM_READ, 0, 40, 0) == 1 &&
        auth_count_usable(6, 10, AUTH_MODE_LOCAL_ONLY) == 1 &&
        auth_count_usable(6, 10, AUTH_MODE_AUTO) == 0 &&
        auth_audit_get(99999, 10, &view) == 0 &&
        auth_last_error() == AUTH_ERR_UNKNOWN_GRANT
      ) {
        check_set(&behavior_audit_count_error_contract, 1, "audit/count/error contract holds");
      } else {
        check_set(&behavior_audit_count_error_contract, 0, "audit/count/error contract failed");
      }
    } else {
      check_set(&behavior_audit_count_error_contract, 0, "error surface fixture failed");
    }
  }

  auth_reset();
  {
    AuthAuditView view;
    if (
      auth_create_local_grant(40, 7, 106, AUTH_PERM_READ, 0, 40, 1) == 1 &&
      auth_delegate(40, 41, 7, 106, AUTH_PERM_READ, 0, 40, 0, 0) == 1 &&
      auth_revoke(40) == 1 &&
      auth_check(7, 106, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 0 &&
      auth_effective_mask(41, 10) == 0 &&
      auth_audit_get(41, 10, &view) == 1 &&
      view.disabled_by_ancestor == 1 &&
      view.revoked == 0 &&
      auth_count_usable(7, 10, AUTH_MODE_LOCAL_ONLY) == 0
    ) {
      check_set(&update_revoke_read_consistency, 1, "revoke updates every read path");
    } else {
      check_set(&update_revoke_read_consistency, 0, "revoke left stale read-path state");
    }
  }

  auth_reset();
  {
    AuthAuditView view;
    if (
      auth_create_local_grant(50, 8, 107, AUTH_PERM_READ, 0, 40, 0) == 1 &&
      auth_import_bundle_grant(51, 8, 107, AUTH_PERM_READ, 0, 40, 0, 1) == 1 &&
      auth_check(8, 107, AUTH_PERM_READ, 10, AUTH_MODE_AUTO) == 0 &&
      auth_check(8, 107, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 1 &&
      auth_attach_bundle_key(51) == 1 &&
      auth_check(8, 107, AUTH_PERM_READ, 10, AUTH_MODE_AUTO) == 1 &&
      auth_audit_get(51, 10, &view) == 1 &&
      view.key_attached == 1 &&
      view.usable == 1
    ) {
      check_set(&update_key_attach_read_consistency, 1, "key attach updates auth state consistently");
    } else {
      check_set(&update_key_attach_read_consistency, 0, "key attach did not refresh read paths");
    }
  }

  auth_reset();
  if (
    auth_create_local_grant(60, 9, 108, AUTH_PERM_READ, 0, 40, 1) == 1 &&
    auth_delegate(60, 61, 9, 108, AUTH_PERM_READ, 0, 40, 0, 0) == 1 &&
    auth_create_local_grant(62, 9, 108, AUTH_PERM_READ, 0, 40, 1) == 1 &&
    auth_delegate(62, 63, 9, 108, AUTH_PERM_READ, 0, 40, 0, 0) == 1 &&
    auth_revoke(60) == 1 &&
    auth_check(9, 108, AUTH_PERM_READ, 10, AUTH_MODE_LOCAL_ONLY) == 1
  ) {
    check_set(&update_independent_chain_isolation, 1, "independent chains stay isolated");
  } else {
    check_set(&update_independent_chain_isolation, 0, "revoke spilled into independent chain");
  }

  {
    uint32_t rng = 0xC0FFEEu;
    int next_id = 1000;
    int ok = 1;
    auth_reset();
    ref_reset();
    for (int step = 0; step < 320 && ok; step++) {
      int op = (int)(lcg_next(&rng) % 8u);
      int mask_options[7] = {
        AUTH_PERM_READ,
        AUTH_PERM_WRITE,
        AUTH_PERM_ADMIN,
        AUTH_PERM_READ | AUTH_PERM_WRITE,
        AUTH_PERM_READ | AUTH_PERM_ADMIN,
        AUTH_PERM_WRITE | AUTH_PERM_ADMIN,
        AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN,
      };
      if (op == 0) {
        int id = next_id++;
        int subject = (int)(lcg_next(&rng) % 10u);
        int resource = (int)(lcg_next(&rng) % 6u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t start = (int64_t)(lcg_next(&rng) % 30u);
        int64_t end = start + 5 + (int64_t)(lcg_next(&rng) % 20u);
        int delegatable = (int)(lcg_next(&rng) & 1u);
        ok =
          ref_create_local_grant(id, subject, resource, mask, start, end, delegatable) ==
            auth_create_local_grant(id, subject, resource, mask, start, end, delegatable) &&
          ref_last_error == auth_last_error();
      } else if (op == 1) {
        int id = next_id++;
        int subject = (int)(lcg_next(&rng) % 10u);
        int resource = (int)(lcg_next(&rng) % 6u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t start = (int64_t)(lcg_next(&rng) % 30u);
        int64_t end = start + 5 + (int64_t)(lcg_next(&rng) % 20u);
        int delegatable = (int)(lcg_next(&rng) & 1u);
        int requires_key = (int)(lcg_next(&rng) & 1u);
        ok =
          ref_import_bundle_grant(id, subject, resource, mask, start, end, delegatable, requires_key) ==
            auth_import_bundle_grant(id, subject, resource, mask, start, end, delegatable, requires_key) &&
          ref_last_error == auth_last_error();
      } else if (op == 2) {
        int id = next_id > 1000
          ? 1000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 1000))
          : 77;
        ok = ref_attach_bundle_key(id) == auth_attach_bundle_key(id) &&
          ref_last_error == auth_last_error();
      } else if (op == 3) {
        int parent_id = next_id > 1000
          ? 1000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 1000))
          : 88;
        int child_id = next_id++;
        int subject = (int)(lcg_next(&rng) % 10u);
        int resource = (int)(lcg_next(&rng) % 6u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t start = (int64_t)(lcg_next(&rng) % 30u);
        int64_t end = start + 2 + (int64_t)(lcg_next(&rng) % 20u);
        int delegatable = (int)(lcg_next(&rng) & 1u);
        int requires_key = (int)(lcg_next(&rng) & 1u);
        ok =
          ref_delegate(parent_id, child_id, subject, resource, mask, start, end, delegatable, requires_key) ==
            auth_delegate(parent_id, child_id, subject, resource, mask, start, end, delegatable, requires_key) &&
          ref_last_error == auth_last_error();
      } else if (op == 4) {
        int id = next_id > 1000
          ? 1000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 1000))
          : 99;
        ok = ref_revoke(id) == auth_revoke(id) && ref_last_error == auth_last_error();
      } else if (op == 5) {
        int subject = (int)(lcg_next(&rng) % 10u);
        int resource = (int)(lcg_next(&rng) % 6u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t ts = (int64_t)(lcg_next(&rng) % 40u);
        int mode = 1 + (int)(lcg_next(&rng) % 3u);
        ok = ref_check(subject, resource, mask, ts, mode) ==
          auth_check(subject, resource, mask, ts, mode) &&
          ref_last_error == auth_last_error();
      } else if (op == 6) {
        int id = next_id > 1000
          ? 1000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 1000))
          : 111;
        int64_t ts = (int64_t)(lcg_next(&rng) % 40u);
        ok = ref_effective_mask_lookup(id, ts) == auth_effective_mask(id, ts) &&
          ref_last_error == auth_last_error();
      } else {
        int id = next_id > 1000
          ? 1000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 1000))
          : 123;
        int subject = (int)(lcg_next(&rng) % 10u);
        int mode = 1 + (int)(lcg_next(&rng) % 3u);
        int64_t ts = (int64_t)(lcg_next(&rng) % 40u);
        AuthAuditView ref_view;
        AuthAuditView actual_view;
        ok =
          ref_audit_get(id, ts, &ref_view) == auth_audit_get(id, ts, &actual_view) &&
          (!ref_audit_get(id, ts, &ref_view) || view_equal(&ref_view, &actual_view)) &&
          ref_count_usable(subject, ts, mode) == auth_count_usable(subject, ts, mode) &&
          ref_last_error == auth_last_error();
      }
    }
    check_set(
      &update_small_trace_equivalence,
      ok,
      ok ? "small randomized trace matches reference" : "small randomized trace diverged"
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_lookup_world(0);
    base_elapsed = measure_read_workload(workload_grant_id_lookup_ratio, 100000, &base_sum);
    seed_lookup_world(3072);
    inflated_elapsed = measure_read_workload(workload_grant_id_lookup_ratio, 100000, &inflated_sum);
    set_ratio_result(
      &scale_grant_id_lookup_ratio,
      "id-lookup",
      base_elapsed,
      inflated_elapsed,
      2.0,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_lookup_world(0);
    base_elapsed = measure_read_workload(workload_audit_lookup_ratio, 80000, &base_sum);
    seed_lookup_world(3072);
    inflated_elapsed = measure_read_workload(workload_audit_lookup_ratio, 80000, &inflated_sum);
    set_ratio_result(
      &scale_audit_lookup_ratio,
      "audit-lookup",
      base_elapsed,
      inflated_elapsed,
      2.0,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_lookup_world(0);
    base_elapsed = measure_read_workload(workload_effective_mask_lookup_ratio, 80000, &base_sum);
    seed_lookup_world(3072);
    inflated_elapsed = measure_read_workload(workload_effective_mask_lookup_ratio, 80000, &inflated_sum);
    set_ratio_result(
      &scale_effective_mask_lookup_ratio,
      "effective-mask",
      base_elapsed,
      inflated_elapsed,
      2.0,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_AUTO_ALL_BUNDLE, 0, 0);
    base_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_AUTO_ALL_BUNDLE, 0, 3072);
    inflated_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_auto_bundle_presence_other_subject_noise,
      "auto-other-noise",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_AUTO_ALL_BUNDLE, 0, 0);
    base_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_AUTO_ALL_BUNDLE, 64, 0);
    inflated_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_auto_bundle_presence_same_subject_noise,
      "auto-same-subject-noise",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_MIXED, 0, 0);
    base_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_MIXED, 32, 2048);
    inflated_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_hot_auth_lookup_ratio,
      "mixed-hot-auth",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_BUNDLE_HEAVY, 0, 0);
    base_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_BUNDLE_HEAVY, 64, 0);
    inflated_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_same_subject_irrelevant_resource_ratio,
      "same-subject-resource-noise",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_BUNDLE_HEAVY, 0, 0);
    base_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_BUNDLE_HEAVY, 0, 3072);
    inflated_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_other_subject_noise_ratio,
      "other-subject-noise",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_count_world(0, 0);
    base_elapsed = measure_read_workload(workload_count_hot_subject, 30000, &base_sum);
    seed_count_world(0, 3072);
    inflated_elapsed = measure_read_workload(workload_count_hot_subject, 30000, &inflated_sum);
    set_ratio_result(
      &scale_count_usable_hot_subject_ratio,
      "count-hot-subject",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_count_world(1, 0);
    base_elapsed = measure_read_workload(workload_count_mode_mix, 30000, &base_sum);
    seed_count_world(1, 3072);
    inflated_elapsed = measure_read_workload(workload_count_mode_mix, 30000, &inflated_sum);
    set_ratio_result(
      &scale_count_usable_mode_mix_ratio,
      "count-mode-mix",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_MIXED, 32, 0);
    base_elapsed = measure_read_workload(workload_mixed_read_loop, 50000, &base_sum);
    seed_auth_world(WORLD_MIXED, 32, 3072);
    inflated_elapsed = measure_read_workload(workload_mixed_read_loop, 50000, &inflated_sum);
    set_ratio_result(
      &scale_mixed_read_loop_ratio,
      "mixed-read-loop",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_deep_chain_world(0);
    base_elapsed = measure_read_workload(workload_deep_chain_hot_read, 60000, &base_sum);
    seed_deep_chain_world(3072);
    inflated_elapsed = measure_read_workload(workload_deep_chain_hot_read, 60000, &inflated_sum);
    set_ratio_result(
      &scale_deep_chain_hot_read_ratio,
      "deep-chain-hot-read",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_BUNDLE_HEAVY, 16, 0);
    base_elapsed = measure_read_workload(workload_bundle_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_BUNDLE_HEAVY, 16, 3072);
    inflated_elapsed = measure_read_workload(workload_bundle_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_bundle_heavy_hotset_ratio,
      "bundle-heavy-hotset",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_LOCAL_HEAVY, 16, 0);
    base_elapsed = measure_read_workload(workload_local_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_LOCAL_HEAVY, 16, 3072);
    inflated_elapsed = measure_read_workload(workload_local_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_local_heavy_hotset_ratio,
      "local-heavy-hotset",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int base_sum;
    int inflated_sum;
    double base_elapsed;
    double inflated_elapsed;
    seed_auth_world(WORLD_MIXED, 16, 0);
    base_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &base_sum);
    seed_auth_world(WORLD_MIXED, 16, 3072);
    inflated_elapsed = measure_read_workload(workload_auto_hot_auth, 120000, &inflated_sum);
    set_ratio_result(
      &scale_mixed_source_hotset_ratio,
      "mixed-source-hotset",
      base_elapsed,
      inflated_elapsed,
      2.5,
      base_sum,
      inflated_sum
    );
  }

  {
    int checksum;
    double elapsed;
    seed_large_world(3072);
    elapsed = measure_read_workload(workload_large_reads, 150000, &checksum);
    set_budget_result(
      &scale_large_read_budget,
      "large-read-budget",
      elapsed,
      1.20,
      checksum
    );
  }

  {
    uint32_t rng = 0xFACE1234u;
    int next_id = 50000;
    int ok = 1;
    for (int step = 0; step < 800 && ok; step++) {
      int op = (int)(lcg_next(&rng) % 8u);
      int mask_options[7] = {
        AUTH_PERM_READ,
        AUTH_PERM_WRITE,
        AUTH_PERM_ADMIN,
        AUTH_PERM_READ | AUTH_PERM_WRITE,
        AUTH_PERM_READ | AUTH_PERM_ADMIN,
        AUTH_PERM_WRITE | AUTH_PERM_ADMIN,
        AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN,
      };
      if (step == 0) {
        auth_reset();
        ref_reset();
      }
      if (op == 0) {
        int id = next_id++;
        int subject = (int)(lcg_next(&rng) % 14u);
        int resource = (int)(lcg_next(&rng) % 8u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t start = (int64_t)(lcg_next(&rng) % 40u);
        int64_t end = start + 5 + (int64_t)(lcg_next(&rng) % 30u);
        int delegatable = (int)(lcg_next(&rng) & 1u);
        ok = ref_create_local_grant(id, subject, resource, mask, start, end, delegatable) ==
          auth_create_local_grant(id, subject, resource, mask, start, end, delegatable) &&
          ref_last_error == auth_last_error();
      } else if (op == 1) {
        int id = next_id++;
        int subject = (int)(lcg_next(&rng) % 14u);
        int resource = (int)(lcg_next(&rng) % 8u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t start = (int64_t)(lcg_next(&rng) % 40u);
        int64_t end = start + 5 + (int64_t)(lcg_next(&rng) % 30u);
        int delegatable = (int)(lcg_next(&rng) & 1u);
        int requires_key = (int)(lcg_next(&rng) & 1u);
        ok = ref_import_bundle_grant(id, subject, resource, mask, start, end, delegatable, requires_key) ==
          auth_import_bundle_grant(id, subject, resource, mask, start, end, delegatable, requires_key) &&
          ref_last_error == auth_last_error();
      } else if (op == 2) {
        int id = next_id > 50000
          ? 50000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 50000))
          : 42;
        ok = ref_attach_bundle_key(id) == auth_attach_bundle_key(id) &&
          ref_last_error == auth_last_error();
      } else if (op == 3) {
        int parent_id = next_id > 50000
          ? 50000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 50000))
          : 44;
        int child_id = next_id++;
        int subject = (int)(lcg_next(&rng) % 14u);
        int resource = (int)(lcg_next(&rng) % 8u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t start = (int64_t)(lcg_next(&rng) % 40u);
        int64_t end = start + 2 + (int64_t)(lcg_next(&rng) % 30u);
        int delegatable = (int)(lcg_next(&rng) & 1u);
        int requires_key = (int)(lcg_next(&rng) & 1u);
        ok = ref_delegate(parent_id, child_id, subject, resource, mask, start, end, delegatable, requires_key) ==
          auth_delegate(parent_id, child_id, subject, resource, mask, start, end, delegatable, requires_key) &&
          ref_last_error == auth_last_error();
      } else if (op == 4) {
        int id = next_id > 50000
          ? 50000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 50000))
          : 46;
        ok = ref_revoke(id) == auth_revoke(id) && ref_last_error == auth_last_error();
      } else if (op == 5) {
        int subject = (int)(lcg_next(&rng) % 14u);
        int resource = (int)(lcg_next(&rng) % 8u);
        int mask = mask_options[lcg_next(&rng) % 7u];
        int64_t ts = (int64_t)(lcg_next(&rng) % 60u);
        int mode = 1 + (int)(lcg_next(&rng) % 3u);
        ok = ref_check(subject, resource, mask, ts, mode) == auth_check(subject, resource, mask, ts, mode) &&
          ref_last_error == auth_last_error();
      } else if (op == 6) {
        int id = next_id > 50000
          ? 50000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 50000))
          : 48;
        int64_t ts = (int64_t)(lcg_next(&rng) % 60u);
        ok = ref_effective_mask_lookup(id, ts) == auth_effective_mask(id, ts) &&
          ref_last_error == auth_last_error();
      } else {
        int id = next_id > 50000
          ? 50000 + (int)(lcg_next(&rng) % (uint32_t)(next_id - 50000))
          : 50;
        int subject = (int)(lcg_next(&rng) % 14u);
        int mode = 1 + (int)(lcg_next(&rng) % 3u);
        int64_t ts = (int64_t)(lcg_next(&rng) % 60u);
        AuthAuditView ref_view;
        AuthAuditView actual_view;
        int ref_audit = ref_audit_get(id, ts, &ref_view);
        int act_audit = auth_audit_get(id, ts, &actual_view);
        ok = ref_audit == act_audit &&
          (!ref_audit || view_equal(&ref_view, &actual_view)) &&
          ref_count_usable(subject, ts, mode) == auth_count_usable(subject, ts, mode) &&
          ref_last_error == auth_last_error();
      }
    }

    if (ok) {
      int checksum;
      double elapsed;
      seed_large_world(3072);
      elapsed = measure_read_workload(workload_large_reads, 120000, &checksum);
      snprintf(
        scale_large_trace_equivalence_budget.msg,
        sizeof(scale_large_trace_equivalence_budget.msg),
        "trace=ok elapsed=%.4fs<=%.4fs sum=%d",
        elapsed,
        1.40,
        checksum
      );
      scale_large_trace_equivalence_budget.ok = elapsed <= 1.40 ? 1 : 0;
    } else {
      check_set(&scale_large_trace_equivalence_budget, 0, "large trace diverged from reference");
    }
  }

  print_check("behavior_source_resolution", &behavior_source_resolution);
  print_check("behavior_time_and_perm_contract", &behavior_time_and_perm_contract);
  print_check("behavior_delegation_and_ancestors", &behavior_delegation_and_ancestors);
  print_check("behavior_audit_count_error_contract", &behavior_audit_count_error_contract);
  print_check("update_revoke_read_consistency", &update_revoke_read_consistency);
  print_check("update_key_attach_read_consistency", &update_key_attach_read_consistency);
  print_check("update_independent_chain_isolation", &update_independent_chain_isolation);
  print_check("update_small_trace_equivalence", &update_small_trace_equivalence);
  print_check("scale_grant_id_lookup_ratio", &scale_grant_id_lookup_ratio);
  print_check("scale_audit_lookup_ratio", &scale_audit_lookup_ratio);
  print_check("scale_effective_mask_lookup_ratio", &scale_effective_mask_lookup_ratio);
  print_check("scale_auto_bundle_presence_other_subject_noise", &scale_auto_bundle_presence_other_subject_noise);
  print_check("scale_auto_bundle_presence_same_subject_noise", &scale_auto_bundle_presence_same_subject_noise);
  print_check("scale_hot_auth_lookup_ratio", &scale_hot_auth_lookup_ratio);
  print_check("scale_same_subject_irrelevant_resource_ratio", &scale_same_subject_irrelevant_resource_ratio);
  print_check("scale_other_subject_noise_ratio", &scale_other_subject_noise_ratio);
  print_check("scale_count_usable_hot_subject_ratio", &scale_count_usable_hot_subject_ratio);
  print_check("scale_count_usable_mode_mix_ratio", &scale_count_usable_mode_mix_ratio);
  print_check("scale_mixed_read_loop_ratio", &scale_mixed_read_loop_ratio);
  print_check("scale_deep_chain_hot_read_ratio", &scale_deep_chain_hot_read_ratio);
  print_check("scale_bundle_heavy_hotset_ratio", &scale_bundle_heavy_hotset_ratio);
  print_check("scale_local_heavy_hotset_ratio", &scale_local_heavy_hotset_ratio);
  print_check("scale_mixed_source_hotset_ratio", &scale_mixed_source_hotset_ratio);
  print_check("scale_large_read_budget", &scale_large_read_budget);
  print_check("scale_large_trace_equivalence_budget", &scale_large_trace_equivalence_budget);
  return 0;
}
