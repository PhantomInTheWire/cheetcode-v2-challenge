#include <cstdint>
typedef struct ExprAuditView { int exists, kind, string_evaluable, match_evaluable, constant_expr, namespace_error, matched, output_string_id; } ExprAuditView;
extern "C" {
__attribute__((visibility("default"))) void expr_reset(void) {}
__attribute__((visibility("default"))) int expr_register_string(int string_id, const char* value) { (void)string_id; (void)value; return 0; }
__attribute__((visibility("default"))) int expr_register_var(int var_id, int namespace_kind, int string_id) { (void)var_id; (void)namespace_kind; (void)string_id; return 0; }
__attribute__((visibility("default"))) int expr_compile_literal(int expr_id, int string_id) { (void)expr_id; (void)string_id; return 0; }
__attribute__((visibility("default"))) int expr_compile_var(int expr_id, int var_id) { (void)expr_id; (void)var_id; return 0; }
__attribute__((visibility("default"))) int expr_compile_email_local(int expr_id, int child_expr_id) { (void)expr_id; (void)child_expr_id; return 0; }
__attribute__((visibility("default"))) int expr_compile_regex_replace(int expr_id, int input_expr_id, int pattern_string_id, int replacement_string_id) { (void)expr_id; (void)input_expr_id; (void)pattern_string_id; (void)replacement_string_id; return 0; }
__attribute__((visibility("default"))) int expr_compile_regex_match(int expr_id, int input_expr_id, int pattern_string_id, int negate) { (void)expr_id; (void)input_expr_id; (void)pattern_string_id; (void)negate; return 0; }
__attribute__((visibility("default"))) int expr_evaluate_string(int expr_id, int* out_string_id) { (void)expr_id; (void)out_string_id; return 0; }
__attribute__((visibility("default"))) int expr_evaluate_match(int expr_id, int matcher_string_id) { (void)expr_id; (void)matcher_string_id; return 0; }
__attribute__((visibility("default"))) int expr_audit_get(int expr_id, int matcher_string_id, ExprAuditView* out_view) { (void)expr_id; (void)matcher_string_id; (void)out_view; return 0; }
__attribute__((visibility("default"))) int expr_last_error(void) { return 0; }
}
