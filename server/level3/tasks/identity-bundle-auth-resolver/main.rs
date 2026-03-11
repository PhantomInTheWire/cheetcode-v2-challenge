#[repr(C)]
pub struct AuthAuditView {
    pub exists: i32,
    pub source: i32,
    pub stored_mask: i32,
    pub effective_mask: i32,
    pub revoked: i32,
    pub requires_key: i32,
    pub key_attached: i32,
    pub not_yet_valid: i32,
    pub expired: i32,
    pub disabled_by_ancestor: i32,
    pub usable: i32,
}

#[no_mangle]
pub extern "C" fn auth_reset() {}

#[no_mangle]
pub extern "C" fn auth_create_local_grant(
    _grant_id: i32,
    _subject_id: i32,
    _resource_id: i32,
    _perms_mask: i32,
    _not_before_ts: i64,
    _expires_ts: i64,
    _delegatable: i32,
) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_import_bundle_grant(
    _grant_id: i32,
    _subject_id: i32,
    _resource_id: i32,
    _perms_mask: i32,
    _not_before_ts: i64,
    _expires_ts: i64,
    _delegatable: i32,
    _requires_key: i32,
) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_attach_bundle_key(_grant_id: i32) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_delegate(
    _parent_grant_id: i32,
    _child_grant_id: i32,
    _subject_id: i32,
    _resource_id: i32,
    _perms_mask: i32,
    _not_before_ts: i64,
    _expires_ts: i64,
    _delegatable: i32,
    _requires_key: i32,
) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_revoke(_grant_id: i32) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_check(
    _subject_id: i32,
    _resource_id: i32,
    _perm_bit: i32,
    _ts: i64,
    _resolve_mode: i32,
) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_effective_mask(_grant_id: i32, _ts: i64) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_audit_get(_grant_id: i32, _ts: i64, _out_view: *mut AuthAuditView) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_count_usable(_subject_id: i32, _ts: i64, _resolve_mode: i32) -> i32 {
    0
}

#[no_mangle]
pub extern "C" fn auth_last_error() -> i32 {
    0
}
