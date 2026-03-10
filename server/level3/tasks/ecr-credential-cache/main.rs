#[repr(C)]
pub struct CredAuditView { pub exists:i32, pub registry_kind:i32, pub cached:i32, pub expired:i32, pub client_error:i32, pub token_id:i32, pub refresh_count:i32, pub usable:i32 }
#[no_mangle] pub extern "C" fn cred_reset() {}
#[no_mangle] pub extern "C" fn cred_set_registry_kind(_: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn cred_inject_token(_: i32, _: i32, _: i64) -> i32 { 0 }
#[no_mangle] pub extern "C" fn cred_get(_: i32, _: i64) -> i32 { 0 }
#[no_mangle] pub extern "C" fn cred_force_expire(_: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn cred_set_client_error(_: i32, _: i32) -> i32 { 0 }
#[no_mangle] pub extern "C" fn cred_audit_get(_: i32, _: i64, _: *mut CredAuditView) -> i32 { 0 }
#[no_mangle] pub extern "C" fn cred_count_cached(_: i64) -> i32 { 0 }
#[no_mangle] pub extern "C" fn cred_last_error() -> i32 { 0 }
