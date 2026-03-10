#include <cstdint>
typedef struct SessionAuditView { int exists, session_revoked, active_generation, staged_generation, presented_generation, grace_generation, grace_active, generation_revoked, compatible, usable; } SessionAuditView;
extern "C" {
__attribute__((visibility("default"))) void session_reset(void) {}
__attribute__((visibility("default"))) int session_create(int session_id, int subject_id, int resource_id, int active_generation) { (void)session_id; (void)subject_id; (void)resource_id; (void)active_generation; return 0; }
__attribute__((visibility("default"))) int session_issue_credential(int credential_id, int session_id, int generation, int64_t issued_ts, int64_t expires_ts) { (void)credential_id; (void)session_id; (void)generation; (void)issued_ts; (void)expires_ts; return 0; }
__attribute__((visibility("default"))) int session_stage_generation(int session_id, int generation, int64_t grace_until_ts) { (void)session_id; (void)generation; (void)grace_until_ts; return 0; }
__attribute__((visibility("default"))) int session_activate_generation(int session_id, int64_t ts) { (void)session_id; (void)ts; return 0; }
__attribute__((visibility("default"))) int session_revoke(int session_id, int generation) { (void)session_id; (void)generation; return 0; }
__attribute__((visibility("default"))) int session_check(int session_id, int generation, int64_t ts) { (void)session_id; (void)generation; (void)ts; return 0; }
__attribute__((visibility("default"))) int session_audit_get(int session_id, int generation, int64_t ts, SessionAuditView* out_view) { (void)session_id; (void)generation; (void)ts; (void)out_view; return 0; }
__attribute__((visibility("default"))) int session_count_active(int subject_id, int64_t ts) { (void)subject_id; (void)ts; return 0; }
__attribute__((visibility("default"))) int session_last_error(void) { return 0; }
}
