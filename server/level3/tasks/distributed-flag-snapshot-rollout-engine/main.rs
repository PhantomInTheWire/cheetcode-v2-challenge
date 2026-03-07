#[repr(C)]
pub struct FlagEvalView {
    pub exists: i32,
    pub environment_id: i32,
    pub decided_version: i32,
    pub matched_snapshot_id: i32,
    pub matched_rule_id: i32,
    pub decided_variant_id: i32,
    pub fallback_used: i32,
    pub tombstone_blocked: i32,
    pub stale_active_seen: i32,
    pub disabled_active_seen: i32,
    pub prerequisite_failed: i32,
    pub off_by_targeting: i32,
    pub usable: i32,
}

#[no_mangle]
pub extern "C" fn flag_reset() {}
#[no_mangle]
pub extern "C" fn flag_define(_: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_define_prerequisite(_: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_publish_snapshot(
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i64,
    _: i64,
) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_publish_tombstone(_: i32, _: i32, _: i32, _: i32, _: i64, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_stage_version(_: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_activate_version(_: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_set_fallback_version(_: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_disable_snapshot(_: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_retire_snapshot(_: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_mark_replica_stale(_: i32, _: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_register_segment_membership(_: i32, _: i32, _: i32) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_evaluate(_: i32, _: i32, _: i32, _: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_explain_get(
    _: i32,
    _: i32,
    _: i32,
    _: i32,
    _: i64,
    _: *mut FlagEvalView,
) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_count_usable_snapshots(_: i32, _: i32, _: i64) -> i32 {
    0
}
#[no_mangle]
pub extern "C" fn flag_last_error() -> i32 {
    0
}
