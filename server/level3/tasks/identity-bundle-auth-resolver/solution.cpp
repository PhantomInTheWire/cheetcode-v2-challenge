#include <cstdint>
#include <cstring>

namespace {

enum {
  AUTH_MAX_GRANTS = 4096,
  AUTH_ID_INDEX_CAP = 16384,
  AUTH_SUBJECT_INDEX_CAP = 8192,
  AUTH_BUCKET_INDEX_CAP = 8192,
  AUTH_SUBJECT_SOURCE_CAP = 8192,
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
};

struct Grant {
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
  int next_bucket;
  int next_subject_source;
  std::int64_t not_before_ts;
  std::int64_t expires_ts;
};

struct IdSlot {
  int used;
  int grant_id;
  int index;
};

struct SubjectSlot {
  int used;
  int subject_id;
  int bundle_count;
};

struct BucketSlot {
  int used;
  int subject_id;
  int source;
  int resource_id;
  int head;
};

struct SubjectSourceSlot {
  int used;
  int subject_id;
  int source;
  int head;
};

Grant grants[AUTH_MAX_GRANTS];
IdSlot id_slots[AUTH_ID_INDEX_CAP];
SubjectSlot subject_slots[AUTH_SUBJECT_INDEX_CAP];
BucketSlot bucket_slots[AUTH_BUCKET_INDEX_CAP];
SubjectSourceSlot subject_source_slots[AUTH_SUBJECT_SOURCE_CAP];
int grant_count = 0;
int last_error = AUTH_OK;

std::uint32_t mix32(std::uint32_t value) {
  value ^= value >> 16;
  value *= 0x7feb352dU;
  value ^= value >> 15;
  value *= 0x846ca68bU;
  value ^= value >> 16;
  return value;
}

std::uint32_t hash1(int a) {
  return mix32(static_cast<std::uint32_t>(a) ^ 0x9e3779b9U);
}

std::uint32_t hash2(int a, int b) {
  return mix32(hash1(a) ^ (static_cast<std::uint32_t>(b) * 0x85ebca6bU));
}

std::uint32_t hash3(int a, int b, int c) {
  return mix32(hash2(a, b) ^ (static_cast<std::uint32_t>(c) * 0xc2b2ae35U));
}

int normalize_mask(int mask) {
  return mask & (AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN);
}

void set_error(int code) {
  last_error = code;
}

int key_attached_value(const Grant& grant) {
  if (grant.source != AUTH_SOURCE_IDENTITY_BUNDLE) return 1;
  if (!grant.requires_key) return 1;
  return grant.key_attached ? 1 : 0;
}

int self_usable(const Grant& grant, std::int64_t ts) {
  if (!grant.used || grant.revoked) return 0;
  if (ts < grant.not_before_ts) return 0;
  if (ts >= grant.expires_ts) return 0;
  return key_attached_value(grant);
}

int find_id_slot(int grant_id) {
  std::uint32_t idx = hash1(grant_id) & (AUTH_ID_INDEX_CAP - 1);
  for (int probe = 0; probe < AUTH_ID_INDEX_CAP; ++probe) {
    IdSlot& slot = id_slots[idx];
    if (!slot.used) return -1;
    if (slot.grant_id == grant_id) return static_cast<int>(idx);
    idx = (idx + 1U) & (AUTH_ID_INDEX_CAP - 1);
  }
  return -1;
}

int lookup_index(int grant_id) {
  const int slot_index = find_id_slot(grant_id);
  return slot_index < 0 ? -1 : id_slots[slot_index].index;
}

int insert_id_slot(int grant_id, int index) {
  std::uint32_t idx = hash1(grant_id) & (AUTH_ID_INDEX_CAP - 1);
  for (int probe = 0; probe < AUTH_ID_INDEX_CAP; ++probe) {
    IdSlot& slot = id_slots[idx];
    if (!slot.used) {
      slot.used = 1;
      slot.grant_id = grant_id;
      slot.index = index;
      return 1;
    }
    if (slot.grant_id == grant_id) return 0;
    idx = (idx + 1U) & (AUTH_ID_INDEX_CAP - 1);
  }
  return 0;
}

SubjectSlot* get_subject_slot(int subject_id, int create) {
  std::uint32_t idx = hash1(subject_id) & (AUTH_SUBJECT_INDEX_CAP - 1);
  for (int probe = 0; probe < AUTH_SUBJECT_INDEX_CAP; ++probe) {
    SubjectSlot& slot = subject_slots[idx];
    if (!slot.used) {
      if (!create) return nullptr;
      slot.used = 1;
      slot.subject_id = subject_id;
      slot.bundle_count = 0;
      return &slot;
    }
    if (slot.subject_id == subject_id) return &slot;
    idx = (idx + 1U) & (AUTH_SUBJECT_INDEX_CAP - 1);
  }
  return nullptr;
}

BucketSlot* get_bucket_slot(int subject_id, int source, int resource_id, int create) {
  std::uint32_t idx = hash3(subject_id, source, resource_id) & (AUTH_BUCKET_INDEX_CAP - 1);
  for (int probe = 0; probe < AUTH_BUCKET_INDEX_CAP; ++probe) {
    BucketSlot& slot = bucket_slots[idx];
    if (!slot.used) {
      if (!create) return nullptr;
      slot.used = 1;
      slot.subject_id = subject_id;
      slot.source = source;
      slot.resource_id = resource_id;
      slot.head = -1;
      return &slot;
    }
    if (
      slot.subject_id == subject_id &&
      slot.source == source &&
      slot.resource_id == resource_id
    ) {
      return &slot;
    }
    idx = (idx + 1U) & (AUTH_BUCKET_INDEX_CAP - 1);
  }
  return nullptr;
}

SubjectSourceSlot* get_subject_source_slot(int subject_id, int source, int create) {
  std::uint32_t idx = hash2(subject_id, source) & (AUTH_SUBJECT_SOURCE_CAP - 1);
  for (int probe = 0; probe < AUTH_SUBJECT_SOURCE_CAP; ++probe) {
    SubjectSourceSlot& slot = subject_source_slots[idx];
    if (!slot.used) {
      if (!create) return nullptr;
      slot.used = 1;
      slot.subject_id = subject_id;
      slot.source = source;
      slot.head = -1;
      return &slot;
    }
    if (slot.subject_id == subject_id && slot.source == source) return &slot;
    idx = (idx + 1U) & (AUTH_SUBJECT_SOURCE_CAP - 1);
  }
  return nullptr;
}

int effective_mask_for_index(int index, std::int64_t ts) {
  int mask = AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN;
  int current = index;
  while (current >= 0) {
    const Grant& grant = grants[current];
    if (!self_usable(grant, ts)) return 0;
    mask &= normalize_mask(grant.stored_mask);
    current = grant.parent_index;
  }
  return mask;
}

int disabled_by_ancestor(int index, std::int64_t ts) {
  int parent = grants[index].parent_index;
  while (parent >= 0) {
    const Grant& grant = grants[parent];
    if (!self_usable(grant, ts)) return 1;
    parent = grant.parent_index;
  }
  return 0;
}

int select_source_for_subject(int subject_id, int resolve_mode) {
  if (resolve_mode == AUTH_MODE_LOCAL_ONLY) return AUTH_SOURCE_LOCAL_PROFILE;
  if (resolve_mode == AUTH_MODE_BUNDLE_ONLY) return AUTH_SOURCE_IDENTITY_BUNDLE;
  SubjectSlot* subject = get_subject_slot(subject_id, 0);
  if (subject && subject->bundle_count > 0) return AUTH_SOURCE_IDENTITY_BUNDLE;
  return AUTH_SOURCE_LOCAL_PROFILE;
}

int register_grant_indices(int index) {
  Grant& grant = grants[index];
  if (!insert_id_slot(grant.id, index)) return 0;
  BucketSlot* bucket = get_bucket_slot(grant.subject_id, grant.source, grant.resource_id, 1);
  SubjectSourceSlot* subject_source =
    get_subject_source_slot(grant.subject_id, grant.source, 1);
  if (!bucket || !subject_source) return 0;
  grant.next_bucket = bucket->head;
  bucket->head = index;
  grant.next_subject_source = subject_source->head;
  subject_source->head = index;
  if (grant.source == AUTH_SOURCE_IDENTITY_BUNDLE) {
    SubjectSlot* subject = get_subject_slot(grant.subject_id, 1);
    if (!subject) return 0;
    subject->bundle_count += 1;
  }
  return 1;
}

int alloc_index() {
  if (grant_count >= AUTH_MAX_GRANTS) return -1;
  return grant_count++;
}

int write_grant(
  int index,
  int grant_id,
  int parent_index,
  int subject_id,
  int resource_id,
  int source,
  int perms_mask,
  std::int64_t not_before_ts,
  std::int64_t expires_ts,
  int delegatable,
  int requires_key
) {
  Grant& grant = grants[index];
  std::memset(&grant, 0, sizeof(grant));
  grant.used = 1;
  grant.id = grant_id;
  grant.parent_index = parent_index;
  grant.subject_id = subject_id;
  grant.resource_id = resource_id;
  grant.source = source;
  grant.stored_mask = normalize_mask(perms_mask);
  grant.delegatable = delegatable ? 1 : 0;
  grant.requires_key =
    source == AUTH_SOURCE_IDENTITY_BUNDLE && requires_key ? 1 : 0;
  grant.key_attached = grant.requires_key ? 0 : 1;
  grant.next_bucket = -1;
  grant.next_subject_source = -1;
  grant.not_before_ts = not_before_ts;
  grant.expires_ts = expires_ts;
  return register_grant_indices(index);
}

}  // namespace

extern "C" {

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

__attribute__((visibility("default"))) void auth_reset(void) {
  std::memset(grants, 0, sizeof(grants));
  std::memset(id_slots, 0, sizeof(id_slots));
  std::memset(subject_slots, 0, sizeof(subject_slots));
  std::memset(bucket_slots, 0, sizeof(bucket_slots));
  std::memset(subject_source_slots, 0, sizeof(subject_source_slots));
  grant_count = 0;
  last_error = AUTH_OK;
}

__attribute__((visibility("default"))) int auth_create_local_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  std::int64_t not_before_ts,
  std::int64_t expires_ts,
  int delegatable
) {
  if (lookup_index(grant_id) >= 0) {
    set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  const int index = alloc_index();
  if (index < 0) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  if (
    !write_grant(
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
    )
  ) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int auth_import_bundle_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  std::int64_t not_before_ts,
  std::int64_t expires_ts,
  int delegatable,
  int requires_key
) {
  if (lookup_index(grant_id) >= 0) {
    set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  const int index = alloc_index();
  if (index < 0) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  if (
    !write_grant(
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
    )
  ) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int auth_attach_bundle_key(int grant_id) {
  const int index = lookup_index(grant_id);
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

__attribute__((visibility("default"))) int auth_delegate(
  int parent_grant_id,
  int child_grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  std::int64_t not_before_ts,
  std::int64_t expires_ts,
  int delegatable,
  int requires_key
) {
  if (lookup_index(child_grant_id) >= 0) {
    set_error(AUTH_ERR_DUPLICATE_ID);
    return 0;
  }
  const int parent_index = lookup_index(parent_grant_id);
  if (parent_index < 0) {
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  Grant& parent = grants[parent_index];
  if (parent.revoked) {
    set_error(AUTH_ERR_PARENT_REVOKED);
    return 0;
  }
  if (!parent.delegatable) {
    set_error(AUTH_ERR_PARENT_NOT_DELEGATABLE);
    return 0;
  }
  if (not_before_ts < parent.not_before_ts) {
    set_error(AUTH_ERR_CHILD_START_TOO_EARLY);
    return 0;
  }
  if (expires_ts > parent.expires_ts) {
    set_error(AUTH_ERR_CHILD_EXPIRES_TOO_LATE);
    return 0;
  }
  if ((normalize_mask(perms_mask) & ~normalize_mask(parent.stored_mask)) != 0) {
    set_error(AUTH_ERR_CHILD_MASK_WIDENS);
    return 0;
  }
  const int child_index = alloc_index();
  if (child_index < 0) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  if (
    !write_grant(
      child_index,
      child_grant_id,
      parent_index,
      subject_id,
      resource_id,
      parent.source,
      perms_mask,
      not_before_ts,
      expires_ts,
      delegatable,
      parent.source == AUTH_SOURCE_IDENTITY_BUNDLE ? requires_key : 0
    )
  ) {
    set_error(AUTH_ERR_CAPACITY);
    return 0;
  }
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int auth_revoke(int grant_id) {
  const int index = lookup_index(grant_id);
  if (index < 0) {
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  grants[index].revoked = 1;
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int auth_check(
  int subject_id,
  int resource_id,
  int perm_bit,
  std::int64_t ts,
  int resolve_mode
) {
  const int requested = normalize_mask(perm_bit);
  if (requested == 0) {
    set_error(AUTH_OK);
    return 0;
  }
  const int source = select_source_for_subject(subject_id, resolve_mode);
  BucketSlot* bucket = get_bucket_slot(subject_id, source, resource_id, 0);
  if (!bucket) {
    set_error(AUTH_OK);
    return 0;
  }
  for (int index = bucket->head; index >= 0; index = grants[index].next_bucket) {
    if ((effective_mask_for_index(index, ts) & requested) == requested) {
      set_error(AUTH_OK);
      return 1;
    }
  }
  set_error(AUTH_OK);
  return 0;
}

__attribute__((visibility("default"))) int auth_effective_mask(int grant_id, std::int64_t ts) {
  const int index = lookup_index(grant_id);
  if (index < 0) {
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  set_error(AUTH_OK);
  return effective_mask_for_index(index, ts);
}

__attribute__((visibility("default"))) int auth_audit_get(
  int grant_id,
  std::int64_t ts,
  AuthAuditView* out_view
) {
  if (!out_view) {
    set_error(AUTH_ERR_OUT_PARAM);
    return 0;
  }
  const int index = lookup_index(grant_id);
  if (index < 0) {
    std::memset(out_view, 0, sizeof(*out_view));
    set_error(AUTH_ERR_UNKNOWN_GRANT);
    return 0;
  }
  Grant& grant = grants[index];
  out_view->exists = 1;
  out_view->source = grant.source;
  out_view->stored_mask = normalize_mask(grant.stored_mask);
  out_view->effective_mask = effective_mask_for_index(index, ts);
  out_view->revoked = grant.revoked ? 1 : 0;
  out_view->requires_key =
    grant.source == AUTH_SOURCE_IDENTITY_BUNDLE && grant.requires_key ? 1 : 0;
  out_view->key_attached = key_attached_value(grant);
  out_view->not_yet_valid = ts < grant.not_before_ts ? 1 : 0;
  out_view->expired = ts >= grant.expires_ts ? 1 : 0;
  out_view->disabled_by_ancestor = disabled_by_ancestor(index, ts);
  out_view->usable = out_view->effective_mask != 0 ? 1 : 0;
  set_error(AUTH_OK);
  return 1;
}

__attribute__((visibility("default"))) int auth_count_usable(
  int subject_id,
  std::int64_t ts,
  int resolve_mode
) {
  const int source = select_source_for_subject(subject_id, resolve_mode);
  SubjectSourceSlot* slot = get_subject_source_slot(subject_id, source, 0);
  int count = 0;
  if (!slot) {
    set_error(AUTH_OK);
    return 0;
  }
  for (int index = slot->head; index >= 0; index = grants[index].next_subject_source) {
    if (effective_mask_for_index(index, ts) != 0) ++count;
  }
  set_error(AUTH_OK);
  return count;
}

__attribute__((visibility("default"))) int auth_last_error(void) {
  return last_error;
}

}  // extern "C"
