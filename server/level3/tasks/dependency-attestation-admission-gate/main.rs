#[repr(C)]
pub struct GateAuditView {
    pub exists: i32,
    pub rollout_enabled: i32,
    pub attested: i32,
    pub waiver_active: i32,
    pub blocked_direct: i32,
    pub blocked_transitive: i32,
    pub stale_attestation: i32,
    pub conflicting_evidence: i32,
    pub admissible: i32,
}
#[no_mangle]
pub extern "C" fn gate_reset() {}
#[no_mangle]
pub extern "C" fn gate_register_service(_: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_set_dependency(_: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_report_attestation(_: i32, _: i32, _: i32, _: i64, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_set_environment_rollout(_: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_add_waiver(_: i32, _: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_block_service(_: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_check_admission(_: i32, _: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_audit_get(_: i32, _: i32, _: i64, _: *mut GateAuditView) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_count_admissible(_: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn gate_last_error() -> i32 {
    0
}
