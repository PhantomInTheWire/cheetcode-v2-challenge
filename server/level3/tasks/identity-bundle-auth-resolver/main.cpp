#include <cstdint>

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

/*
 * Candidate starter template.
 * Implement the resolver semantics from the specification.
 */

__attribute__((visibility("default"))) void auth_reset(void) {}

__attribute__((visibility("default"))) int
auth_create_local_grant(int grant_id, int subject_id, int resource_id,
                        int perms_mask, std::int64_t not_before_ts,
                        std::int64_t expires_ts, int delegatable) {
  (void)grant_id;
  (void)subject_id;
  (void)resource_id;
  (void)perms_mask;
  (void)not_before_ts;
  (void)expires_ts;
  (void)delegatable;
  return 0;
}

__attribute__((visibility("default"))) int
auth_import_bundle_grant(int grant_id, int subject_id, int resource_id,
                         int perms_mask, std::int64_t not_before_ts,
                         std::int64_t expires_ts, int delegatable,
                         int requires_key) {
  (void)grant_id;
  (void)subject_id;
  (void)resource_id;
  (void)perms_mask;
  (void)not_before_ts;
  (void)expires_ts;
  (void)delegatable;
  (void)requires_key;
  return 0;
}

__attribute__((visibility("default"))) int
auth_attach_bundle_key(int grant_id) {
  (void)grant_id;
  return 0;
}

__attribute__((visibility("default"))) int
auth_delegate(int parent_grant_id, int child_grant_id, int subject_id,
              int resource_id, int perms_mask, std::int64_t not_before_ts,
              std::int64_t expires_ts, int delegatable, int requires_key) {
  (void)parent_grant_id;
  (void)child_grant_id;
  (void)subject_id;
  (void)resource_id;
  (void)perms_mask;
  (void)not_before_ts;
  (void)expires_ts;
  (void)delegatable;
  (void)requires_key;
  return 0;
}

__attribute__((visibility("default"))) int auth_revoke(int grant_id) {
  (void)grant_id;
  return 0;
}

__attribute__((visibility("default"))) int
auth_check(int subject_id, int resource_id, int perm_bit, std::int64_t ts,
           int resolve_mode) {
  (void)subject_id;
  (void)resource_id;
  (void)perm_bit;
  (void)ts;
  (void)resolve_mode;
  return 0;
}

__attribute__((visibility("default"))) int
auth_effective_mask(int grant_id, std::int64_t ts) {
  (void)grant_id;
  (void)ts;
  return 0;
}

__attribute__((visibility("default"))) int
auth_audit_get(int grant_id, std::int64_t ts, AuthAuditView *out_view) {
  (void)grant_id;
  (void)ts;
  (void)out_view;
  return 0;
}

__attribute__((visibility("default"))) int
auth_count_usable(int subject_id, std::int64_t ts, int resolve_mode) {
  (void)subject_id;
  (void)ts;
  (void)resolve_mode;
  return 0;
}

__attribute__((visibility("default"))) int auth_last_error(void) { return 0; }

} // extern "C"
