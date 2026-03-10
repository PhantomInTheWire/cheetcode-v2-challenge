#[repr(C)]
pub struct ResolverAuditView { pub exists: i32, pub resolved: i32, pub redirected: i32, pub synthesized_init: i32, pub deprecated_redirect: i32, pub tombstoned: i32, pub ambiguous_import: i32, pub included_in_payload: i32 }
#[no_mangle] pub extern "C" fn resolver_reset() {}
#[no_mangle] pub extern "C" fn resolver_add_module(_: i32, _: i32, _: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn resolver_add_import(_: i32, _: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn resolver_add_redirect(_: i32, _: i32, _: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn resolver_build_payload(_: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn resolver_payload_contains(_: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn resolver_audit_get(_: i32, _: i32, _: *mut ResolverAuditView) -> i32 { 0 }
#[no_mangle] pub extern "C" fn resolver_count_payload_modules(_: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn resolver_last_error() -> i32 { 0 }
