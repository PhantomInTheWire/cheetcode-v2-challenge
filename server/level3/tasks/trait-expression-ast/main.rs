#[repr(C)]
pub struct ExprAuditView { pub exists:i32, pub kind:i32, pub string_evaluable:i32, pub match_evaluable:i32, pub constant_expr:i32, pub namespace_error:i32, pub matched:i32, pub output_string_id:i32 }
#[no_mangle] pub extern "C" fn expr_reset() {}
#[no_mangle] pub extern "C" fn expr_register_string(_: i32, _: *const std::ffi::c_char) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_register_var(_: i32, _: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_compile_literal(_: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_compile_var(_: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_compile_email_local(_: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_compile_regex_replace(_: i32, _: i32, _: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_compile_regex_match(_: i32, _: i32, _: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_evaluate_string(_: i32, _: *mut i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_evaluate_match(_: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_audit_get(_: i32, _: i32, _: *mut ExprAuditView) -> i32 { 0 }
#[no_mangle] pub extern "C" fn expr_last_error() -> i32 { 0 }
