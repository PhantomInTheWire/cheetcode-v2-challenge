#include <cstdint>
typedef struct ResolverAuditView { int exists, resolved, redirected, synthesized_init, deprecated_redirect, tombstoned, ambiguous_import, included_in_payload; } ResolverAuditView;
extern "C" {
__attribute__((visibility("default"))) void resolver_reset(void) {}
__attribute__((visibility("default"))) int resolver_add_module(int module_id, int parent_module_id, int is_package, int has_init) { (void)module_id; (void)parent_module_id; (void)is_package; (void)has_init; return 0; }
__attribute__((visibility("default"))) int resolver_add_import(int owner_module_id, int target_module_id, int ambiguous) { (void)owner_module_id; (void)target_module_id; (void)ambiguous; return 0; }
__attribute__((visibility("default"))) int resolver_add_redirect(int from_module_id, int to_module_id, int deprecated, int tombstoned) { (void)from_module_id; (void)to_module_id; (void)deprecated; (void)tombstoned; return 0; }
__attribute__((visibility("default"))) int resolver_build_payload(int root_module_id) { (void)root_module_id; return 0; }
__attribute__((visibility("default"))) int resolver_payload_contains(int root_module_id, int module_id) { (void)root_module_id; (void)module_id; return 0; }
__attribute__((visibility("default"))) int resolver_audit_get(int root_module_id, int module_id, ResolverAuditView* out_view) { (void)root_module_id; (void)module_id; (void)out_view; return 0; }
__attribute__((visibility("default"))) int resolver_count_payload_modules(int root_module_id) { (void)root_module_id; return 0; }
__attribute__((visibility("default"))) int resolver_last_error(void) { return 0; }
}
