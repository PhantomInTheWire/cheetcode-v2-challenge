#include <cstdint>
typedef struct CredAuditView { int exists, registry_kind, cached, expired, client_error, token_id, refresh_count, usable; } CredAuditView;
extern "C" {
__attribute__((visibility("default"))) void cred_reset(void) {}
__attribute__((visibility("default"))) int cred_set_registry_kind(int registry_id, int registry_kind) { (void)registry_id; (void)registry_kind; return 0; }
__attribute__((visibility("default"))) int cred_inject_token(int registry_id, int token_id, int64_t expires_ts) { (void)registry_id; (void)token_id; (void)expires_ts; return 0; }
__attribute__((visibility("default"))) int cred_get(int registry_id, int64_t now_ts) { (void)registry_id; (void)now_ts; return 0; }
__attribute__((visibility("default"))) int cred_force_expire(int registry_id) { (void)registry_id; return 0; }
__attribute__((visibility("default"))) int cred_set_client_error(int registry_id, int error_code) { (void)registry_id; (void)error_code; return 0; }
__attribute__((visibility("default"))) int cred_audit_get(int registry_id, int64_t now_ts, CredAuditView* out_view) { (void)registry_id; (void)now_ts; (void)out_view; return 0; }
__attribute__((visibility("default"))) int cred_count_cached(int64_t now_ts) { (void)now_ts; return 0; }
__attribute__((visibility("default"))) int cred_last_error(void) { return 0; }
}
