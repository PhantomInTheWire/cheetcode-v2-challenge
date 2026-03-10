#include <stdint.h>
typedef struct GateAuditView { int exists, rollout_enabled, attested, waiver_active, blocked_direct, blocked_transitive, stale_attestation, conflicting_evidence, admissible; } GateAuditView;
__attribute__((visibility("default"))) void gate_reset(void) {}
__attribute__((visibility("default"))) int gate_register_service(int service_id) { (void)service_id; return 0; }
__attribute__((visibility("default"))) int gate_set_dependency(int service_id, int dependency_id) { (void)service_id; (void)dependency_id; return 0; }
__attribute__((visibility("default"))) int gate_report_attestation(int service_id, int environment_id, int status, int64_t observed_ts, int64_t valid_until_ts) { (void)service_id; (void)environment_id; (void)status; (void)observed_ts; (void)valid_until_ts; return 0; }
__attribute__((visibility("default"))) int gate_set_environment_rollout(int service_id, int environment_id, int enabled) { (void)service_id; (void)environment_id; (void)enabled; return 0; }
__attribute__((visibility("default"))) int gate_add_waiver(int service_id, int environment_id, int64_t valid_until_ts) { (void)service_id; (void)environment_id; (void)valid_until_ts; return 0; }
__attribute__((visibility("default"))) int gate_block_service(int service_id, int blocked) { (void)service_id; (void)blocked; return 0; }
__attribute__((visibility("default"))) int gate_check_admission(int service_id, int environment_id, int64_t ts) { (void)service_id; (void)environment_id; (void)ts; return 0; }
__attribute__((visibility("default"))) int gate_audit_get(int service_id, int environment_id, int64_t ts, GateAuditView* out_view) { (void)service_id; (void)environment_id; (void)ts; (void)out_view; return 0; }
__attribute__((visibility("default"))) int gate_count_admissible(int environment_id, int64_t ts) { (void)environment_id; (void)ts; return 0; }
__attribute__((visibility("default"))) int gate_last_error(void) { return 0; }
