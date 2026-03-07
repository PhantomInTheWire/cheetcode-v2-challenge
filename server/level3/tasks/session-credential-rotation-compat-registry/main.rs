#[repr(C)]
pub struct SessionAuditView {
    pub exists: i32,
    pub session_revoked: i32,
    pub active_generation: i32,
    pub staged_generation: i32,
    pub presented_generation: i32,
    pub grace_generation: i32,
    pub grace_active: i32,
    pub generation_revoked: i32,
    pub compatible: i32,
    pub usable: i32,
}
#[no_mangle]
pub extern "C" fn session_reset() {}
#[no_mangle]
pub extern "C" fn session_create(_: i32, _: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_issue_credential(_: i32, _: i32, _: i32, _: i64, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_stage_generation(_: i32, _: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_activate_generation(_: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_revoke(_: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_check(_: i32, _: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_audit_get(_: i32, _: i32, _: i64, _: *mut SessionAuditView) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_count_active(_: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn session_last_error() -> i32 {
    0
}
