#[repr(C)]
pub struct PolicyExplainView {
    pub exists: i32,
    pub matched_snapshot_id: i32,
    pub decided_version: i32,
    pub allow_mask: i32,
    pub deny_mask: i32,
    pub fallback_used: i32,
    pub stale_snapshot: i32,
    pub disabled_snapshot: i32,
    pub usable: i32,
}

#[no_mangle]
pub extern "C" fn policy_reset() {}
#[no_mangle]
pub extern "C" fn policy_publish_snapshot(_: i32, _: i32, _: i32, _: i32, _: i32, _: i32, _: i32, _: i64, _: i64) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_set_subject_binding(_: i32, _: i32, _: i32) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_stage_version(_: i32, _: i32) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_activate_version(_: i32) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_retire_snapshot(_: i32) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_disable_snapshot(_: i32) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_check(_: i32, _: i32, _: i32, _: i64) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_explain_get(_: i32, _: i32, _: i32, _: i64, _: *mut PolicyExplainView) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_count_subject_rules(_: i32, _: i64) -> i32 { 0 }
#[no_mangle]
pub extern "C" fn policy_last_error() -> i32 { 0 }
