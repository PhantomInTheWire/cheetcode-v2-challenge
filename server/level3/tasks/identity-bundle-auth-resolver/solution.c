#include <stdint.h>
#include <string.h>

enum {
  AUTH_MAX_GRANTS = 4096,
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
  AUTH_ID_SLOT_CAP = 16384,
  AUTH_SUBJECT_SLOT_CAP = 8192,
  AUTH_BUCKET_SLOT_CAP = 16384,
  AUTH_SUBJECT_SOURCE_SLOT_CAP = 8192,
};

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

typedef struct Grant {
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
  int next_resource_bucket;
  int next_subject_source;
  int64_t not_before_ts;
  int64_t expires_ts;
} Grant;

typedef struct IdSlot {
  int used;
  int grant_id;
  int grant_index;
} IdSlot;

typedef struct SubjectSlot {
  int used;
  int subject_id;
  int bundle_grant_count;
} SubjectSlot;

typedef struct ResourceBucketSlot {
  int used;
  int subject_id;
  int source;
  int resource_id;
  int head_index;
} ResourceBucketSlot;

typedef struct SubjectSourceSlot {
  int used;
  int subject_id;
  int source;
  int head_index;
} SubjectSourceSlot;

static Grant grants[AUTH_MAX_GRANTS];
static IdSlot id_slots[AUTH_ID_SLOT_CAP];
static SubjectSlot subject_slots[AUTH_SUBJECT_SLOT_CAP];
static ResourceBucketSlot resource_buckets[AUTH_BUCKET_SLOT_CAP];
static SubjectSourceSlot subject_source_slots[AUTH_SUBJECT_SOURCE_SLOT_CAP];
static int last_error = AUTH_OK;

static uint32_t mix_u32(uint32_t value) {
  value ^= value >> 16;
  value *= 0x7feb352du;
  value ^= value >> 15;
  value *= 0x846ca68bu;
  value ^= value >> 16;
  return value;
}

static uint32_t hash3(int a, int b, int c) {
  uint32_t value = mix_u32((uint32_t)a);
  value ^= mix_u32((uint32_t)b + 0x9e3779b9u);
  value ^= mix_u32((uint32_t)c + 0x85ebca6bu);
  return mix_u32(value);
}

static uint32_t hash2(int a, int b) {
  uint32_t value = mix_u32((uint32_t)a);
  value ^= mix_u32((uint32_t)b + 0x9e3779b9u);
  return mix_u32(value);
}

static void set_error(int code) { last_error = code; }

static int normalize_mask(int mask) {
  return mask & (AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN);
}

static int id_slot_for(int grant_id, int create) {
  uint32_t start = mix_u32((uint32_t)grant_id) & (AUTH_ID_SLOT_CAP - 1u);
  for (uint32_t probe = 0; probe < AUTH_ID_SLOT_CAP; probe++) {
    uint32_t slot = (start + probe) & (AUTH_ID_SLOT_CAP - 1u);
    if (!id_slots[slot].used)
      return create ? (int)slot : -1;
    if (id_slots[slot].grant_id == grant_id)
      return (int)slot;
  }
  return -1;
}

static int find_index(int grant_id) {
  int slot = id_slot_for(grant_id, 0);
  return slot >= 0 ? id_slots[slot].grant_index : -1;
}

static int subject_slot_for(int subject_id, int create) {
  uint32_t start = mix_u32((uint32_t)subject_id) & (AUTH_SUBJECT_SLOT_CAP - 1u);
  for (uint32_t probe = 0; probe < AUTH_SUBJECT_SLOT_CAP; probe++) {
    uint32_t slot = (start + probe) & (AUTH_SUBJECT_SLOT_CAP - 1u);
    if (!subject_slots[slot].used) {
      if (!create)
        return -1;
      subject_slots[slot].used = 1;
      subject_slots[slot].subject_id = subject_id;
      subject_slots[slot].bundle_grant_count = 0;
      return (int)slot;
    }
    if (subject_slots[slot].subject_id == subject_id)
      return (int)slot;
  }
  return -1;
}

static int resource_bucket_slot_for(int subject_id, int source, int resource_id,
                                    int create) {
  uint32_t start =
      hash3(subject_id, source, resource_id) & (AUTH_BUCKET_SLOT_CAP - 1u);
  for (uint32_t probe = 0; probe < AUTH_BUCKET_SLOT_CAP; probe++) {
    uint32_t slot = (start + probe) & (AUTH_BUCKET_SLOT_CAP - 1u);
    ResourceBucketSlot *bucket = &resource_buckets[slot];
    if (!bucket->used) {
      if (!create)
        return -1;
      bucket->used = 1;
      bucket->subject_id = subject_id;
      bucket->source = source;
      bucket->resource_id = resource_id;
      bucket->head_index = -1;
      return (int)slot;
    }
    if (bucket->subject_id == subject_id && bucket->source == source &&
        bucket->resource_id == resource_id) {
      return (int)slot;
    }
  }
  return -1;
}

static int subject_source_slot_for(int subject_id, int source, int create) {
  uint32_t start =
      hash2(subject_id, source) & (AUTH_SUBJECT_SOURCE_SLOT_CAP - 1u);
  for (uint32_t probe = 0; probe < AUTH_SUBJECT_SOURCE_SLOT_CAP; probe++) {
    uint32_t slot = (start + probe) & (AUTH_SUBJECT_SOURCE_SLOT_CAP - 1u);
    SubjectSourceSlot *entry = &subject_source_slots[slot];
    if (!entry->used) {
      if (!create)
        return -1;
      entry->used = 1;
      entry->subject_id = subject_id;
      entry->source = source;
      entry->head_index = -1;
      return (int)slot;
    }
    if (entry->subject_id == subject_id && entry->source == source)
      return (int)slot;
  }
  return -1;
}

static int alloc_index(void) {
  for (int i = 0; i < AUTH_MAX_GRANTS; i++) {
    if (!grants[i].used)
      return i;
  }
  return -1;
}

static int key_attached_value(const Grant *grant) {
  if (grant->source != AUTH_SOURCE_IDENTITY_BUNDLE)
    return 1;
  if (!grant->requires_key)
    return 1;
  return grant->key_attached ? 1 : 0;
}

static int self_usable(const Grant *grant, int64_t ts) {
  if (!grant->used || grant->revoked)
    return 0;
  if (ts < grant->not_before_ts)
    return 0;
  if (ts >= grant->expires_ts)
    return 0;
  return key_attached_value(grant);
}

static int effective_mask_for_index(int index, int64_t ts) {
  int mask = AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN;
  int current = index;
  while (current >= 0) {
    const Grant *grant;
    if (current >= AUTH_MAX_GRANTS)
      return 0;
    grant = &grants[current];
    if (!self_usable(grant, ts))
      return 0;
    mask &= normalize_mask(grant->stored_mask);
    current = grant->parent_index;
  }
  return mask;
}

static int disabled_by_ancestor(int index, int64_t ts) {
  int parent = grants[index].parent_index;
  while (parent >= 0) {
    if (!self_usable(&grants[parent], ts))
      return 1;
    parent = grants[parent].parent_index;
  }
  return 0;
}

static int select_source_for_subject(int subject_id, int resolve_mode) {
  if (resolve_mode == AUTH_MODE_LOCAL_ONLY)
    return AUTH_SOURCE_LOCAL_PROFILE;
  if (resolve_mode == AUTH_MODE_BUNDLE_ONLY)
    return AUTH_SOURCE_IDENTITY_BUNDLE;

  {
    int slot = subject_slot_for(subject_id, 0);
    if (slot >= 0 && subject_slots[slot].bundle_grant_count > 0) {
      return AUTH_SOURCE_IDENTITY_BUNDLE;
    }
  }
  return AUTH_SOURCE_LOCAL_PROFILE;
}

static void index_grant(int grant_index) {
  Grant *grant = &grants[grant_index];
  int id_slot = id_slot_for(grant->id, 1);
  int resource_slot = resource_bucket_slot_for(grant->subject_id, grant->source,
                                               grant->resource_id, 1);
  int subject_source_slot =
      subject_source_slot_for(grant->subject_id, grant->source, 1);

  id_slots[id_slot].used = 1;
  id_slots[id_slot].grant_id = grant->id;
  id_slots[id_slot].grant_index = grant_index;

  grant->next_resource_bucket = resource_buckets[resource_slot].head_index;
  resource_buckets[resource_slot].head_index = grant_index;

  grant->next_subject_source =
      subject_source_slots[subject_source_slot].head_index;
  subject_source_slots[subject_source_slot].head_index = grant_index;

  if (grant->source == AUTH_SOURCE_IDENTITY_BUNDLE) {
    int subject_slot = subject_slot_for(grant->subject_id, 1);
    subject_slots[subject_slot].bundle_grant_count += 1;
  }
}

static void write_grant(int index, int grant_id, int parent_index,
                        int subject_id, int resource_id, int source,
                        int perms_mask, int64_t not_before_ts,
                        int64_t expires_ts, int delegatable, int requires_key) {
  Grant *grant = &grants[index];
  grant->used = 1;
  grant->id = grant_id;
  grant->parent_index = parent_index;
  grant->subject_id = subject_id;
  grant->resource_id = resource_id;
  grant->source = source;
  grant->stored_mask = normalize_mask(perms_mask);
  grant->delegatable = delegatable ? 1 : 0;
  grant->requires_key =
      source == AUTH_SOURCE_IDENTITY_BUNDLE && requires_key ? 1 : 0;
  grant->key_attached = grant->requires_key ? 0 : 1;
  grant->revoked = 0;
  grant->next_resource_bucket = -1;
  grant->next_subject_source = -1;
  grant->not_before_ts = not_before_ts;
  grant->expires_ts = expires_ts;
  index_grant(index);
}

__attribute__((visibility("default"))) void auth_reset(void) {
  memset(grants, 0, sizeof(grants));
  memset(id_slots, 0, sizeof(id_slots));
  memset(subject_slots, 0, sizeof(subject_slots));
  memset(resource_buckets, 0, sizeof(resource_buckets));
  memset(subject_source_slots, 0, sizeof(subject_source_slots));
  last_error = AUTH_OK;
}

__attribute__((visibility("default"))) int
auth_create_local_grant(int grant_id, int subject_id, int resource_id,
                        int perms_mask, int64_t not_before_ts,
                        int64_t expires_ts, int delegatable) {
  int index;
  if (find_index(grant_id) >= 0) {
    set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  index = alloc_index();
  if (index < 0) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  write_grant(index, grant_id, -1, subject_id, resource_id,
              AUTH_SOURCE_LOCAL_PROFILE, perms_mask, not_before_ts, expires_ts,
              delegatable, 0);
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int
auth_import_bundle_grant(int grant_id, int subject_id, int resource_id,
                         int perms_mask, int64_t not_before_ts,
                         int64_t expires_ts, int delegatable,
                         int requires_key) {
  int index;
  if (find_index(grant_id) >= 0) {
    set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  index = alloc_index();
  if (index < 0) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  write_grant(index, grant_id, -1, subject_id, resource_id,
              AUTH_SOURCE_IDENTITY_BUNDLE, perms_mask, not_before_ts,
              expires_ts, delegatable, requires_key);
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int
auth_attach_bundle_key(int grant_id) {
  int index = find_index(grant_id);
  if (index < 0) {
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  if (grants[index].source != AUTH_SOURCE_IDENTITY_BUNDLE) {
    set_error(AUTH_ERR_WRONG_SOURCE);
    return 0;
  }
  grants[index].key_attached = 1;
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int
auth_delegate(int parent_grant_id, int child_grant_id, int subject_id,
              int resource_id, int perms_mask, int64_t not_before_ts,
              int64_t expires_ts, int delegatable, int requires_key) {
  int parent_index;
  int child_index;
  Grant *parent;
  if (find_index(child_grant_id) >= 0) {
    set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  parent_index = find_index(parent_grant_id);
  if (parent_index < 0) {
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  parent = &grants[parent_index];
  if (parent->revoked) {
    set_error(AUTH_ERR_PARENT_REVOKED);
    return 0;
  }
  if (!parent->delegatable) {
    set_error(AUTH_ERR_PARENT_NOT_DELEGATABLE);
    return 0;
  }
  if (not_before_ts < parent->not_before_ts) {
    set_error(AUTH_ERR_CHILD_START_TOO_EARLY);
    return 0;
  }
  if (expires_ts > parent->expires_ts) {
    set_error(AUTH_ERR_CHILD_EXPIRES_TOO_LATE);
    return 0;
  }
  if ((normalize_mask(perms_mask) & ~normalize_mask(parent->stored_mask)) !=
      0) {
    set_error(AUTH_ERR_CHILD_MASK_WIDENS);
    return 0;
  }
  child_index = alloc_index();
  if (child_index < 0) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  write_grant(child_index, child_grant_id, parent_index, subject_id,
              resource_id, parent->source, perms_mask, not_before_ts,
              expires_ts, delegatable,
              parent->source == AUTH_SOURCE_IDENTITY_BUNDLE ? requires_key : 0);
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int auth_revoke(int grant_id) {
  int index = find_index(grant_id);
  if (index < 0) {
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  grants[index].revoked = 1;
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int auth_check(int subject_id,
                                                      int resource_id,
                                                      int perm_bit, int64_t ts,
                                                      int resolve_mode) {
  int source = select_source_for_subject(subject_id, resolve_mode);
  int requested = normalize_mask(perm_bit);
  int bucket_slot;
  if (requested == 0) {
    set_error(AUTH_OK);
    return 0;
  }
  bucket_slot = resource_bucket_slot_for(subject_id, source, resource_id, 0);
  if (bucket_slot < 0) {
    set_error(AUTH_OK);
    return 0;
  }
  for (int current = resource_buckets[bucket_slot].head_index; current >= 0;
       current = grants[current].next_resource_bucket) {
    if ((effective_mask_for_index(current, ts) & requested) == requested) {
      set_error(AUTH_OK);
      return 1;
    }
  }
  set_error(AUTH_OK);
  return 0;
}

__attribute__((visibility("default"))) int auth_effective_mask(int grant_id,
                                                               int64_t ts) {
  int index = find_index(grant_id);
  if (index < 0) {
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  set_error(AUTH_OK);
  return effective_mask_for_index(index, ts);
}

__attribute__((visibility("default"))) int
auth_audit_get(int grant_id, int64_t ts, AuthAuditView *out_view) {
  int index;
  Grant *grant;
  if (!out_view) {
    set_error(AUTH_ERR_OUT_PARAM);
    return 0;
  }
  index = find_index(grant_id);
  if (index < 0) {
    memset(out_view, 0, sizeof(*out_view));
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  grant = &grants[index];
  out_view->exists = 1;
  out_view->source = grant->source;
  out_view->stored_mask = normalize_mask(grant->stored_mask);
  out_view->effective_mask = effective_mask_for_index(index, ts);
  out_view->revoked = grant->revoked ? 1 : 0;
  out_view->requires_key =
      grant->source == AUTH_SOURCE_IDENTITY_BUNDLE && grant->requires_key ? 1
                                                                          : 0;
  out_view->key_attached = key_attached_value(grant);
  out_view->not_yet_valid = ts < grant->not_before_ts ? 1 : 0;
  out_view->expired = ts >= grant->expires_ts ? 1 : 0;
  out_view->disabled_by_ancestor = disabled_by_ancestor(index, ts);
  out_view->usable = out_view->effective_mask != 0 ? 1 : 0;
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int
auth_count_usable(int subject_id, int64_t ts, int resolve_mode) {
  int source = select_source_for_subject(subject_id, resolve_mode);
  int slot = subject_source_slot_for(subject_id, source, 0);
  int count = 0;
  if (slot < 0) {
    set_error(AUTH_OK);
    return 0;
  }
  for (int current = subject_source_slots[slot].head_index; current >= 0;
       current = grants[current].next_subject_source) {
    if (effective_mask_for_index(current, ts) != 0)
      count++;
  }
  set_error(AUTH_OK);
  return count;
}

__attribute__((visibility("default"))) int auth_last_error(void) {
  return last_error;
}
