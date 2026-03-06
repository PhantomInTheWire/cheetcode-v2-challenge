const AUTH_MAX_GRANTS: usize = 4096;
const AUTH_ID_INDEX_CAP: usize = 16384;
const AUTH_SUBJECT_INDEX_CAP: usize = 8192;
const AUTH_BUCKET_INDEX_CAP: usize = 8192;
const AUTH_SUBJECT_SOURCE_CAP: usize = 8192;
const AUTH_PERM_READ: i32 = 1;
const AUTH_PERM_WRITE: i32 = 2;
const AUTH_PERM_ADMIN: i32 = 4;
const AUTH_SOURCE_LOCAL_PROFILE: i32 = 1;
const AUTH_SOURCE_IDENTITY_BUNDLE: i32 = 2;
const AUTH_MODE_LOCAL_ONLY: i32 = 1;
const AUTH_MODE_BUNDLE_ONLY: i32 = 2;
const AUTH_MODE_AUTO: i32 = 3;
const AUTH_OK: i32 = 0;
const AUTH_ERR_DUPLICATE_ID: i32 = 1;
const AUTH_ERR_UNKNOWN_GRANT: i32 = 2;
const AUTH_ERR_WRONG_SOURCE: i32 = 3;
const AUTH_ERR_PARENT_NOT_DELEGATABLE: i32 = 4;
const AUTH_ERR_CHILD_MASK_WIDENS: i32 = 5;
const AUTH_ERR_CHILD_START_TOO_EARLY: i32 = 6;
const AUTH_ERR_CHILD_EXPIRES_TOO_LATE: i32 = 7;
const AUTH_ERR_OUT_PARAM: i32 = 8;
const AUTH_ERR_CAPACITY: i32 = 9;
const AUTH_ERR_PARENT_REVOKED: i32 = 10;

#[repr(C)]
#[derive(Copy, Clone)]
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

#[derive(Copy, Clone)]
struct Grant {
    used: i32,
    id: i32,
    parent_index: i32,
    subject_id: i32,
    resource_id: i32,
    source: i32,
    stored_mask: i32,
    delegatable: i32,
    requires_key: i32,
    key_attached: i32,
    revoked: i32,
    next_bucket: i32,
    next_subject_source: i32,
    not_before_ts: i64,
    expires_ts: i64,
}

impl Grant {
    const fn empty() -> Self {
        Self {
            used: 0,
            id: 0,
            parent_index: -1,
            subject_id: 0,
            resource_id: 0,
            source: 0,
            stored_mask: 0,
            delegatable: 0,
            requires_key: 0,
            key_attached: 1,
            revoked: 0,
            next_bucket: -1,
            next_subject_source: -1,
            not_before_ts: 0,
            expires_ts: 0,
        }
    }
}

#[derive(Copy, Clone)]
struct IdSlot {
    used: i32,
    grant_id: i32,
    index: i32,
}

impl IdSlot {
    const fn empty() -> Self {
        Self {
            used: 0,
            grant_id: 0,
            index: -1,
        }
    }
}

#[derive(Copy, Clone)]
struct SubjectSlot {
    used: i32,
    subject_id: i32,
    bundle_count: i32,
}

impl SubjectSlot {
    const fn empty() -> Self {
        Self {
            used: 0,
            subject_id: 0,
            bundle_count: 0,
        }
    }
}

#[derive(Copy, Clone)]
struct BucketSlot {
    used: i32,
    subject_id: i32,
    source: i32,
    resource_id: i32,
    head: i32,
}

impl BucketSlot {
    const fn empty() -> Self {
        Self {
            used: 0,
            subject_id: 0,
            source: 0,
            resource_id: 0,
            head: -1,
        }
    }
}

#[derive(Copy, Clone)]
struct SubjectSourceSlot {
    used: i32,
    subject_id: i32,
    source: i32,
    head: i32,
}

impl SubjectSourceSlot {
    const fn empty() -> Self {
        Self {
            used: 0,
            subject_id: 0,
            source: 0,
            head: -1,
        }
    }
}

static mut GRANTS: [Grant; AUTH_MAX_GRANTS] = [Grant::empty(); AUTH_MAX_GRANTS];
static mut ID_SLOTS: [IdSlot; AUTH_ID_INDEX_CAP] = [IdSlot::empty(); AUTH_ID_INDEX_CAP];
static mut SUBJECT_SLOTS: [SubjectSlot; AUTH_SUBJECT_INDEX_CAP] =
    [SubjectSlot::empty(); AUTH_SUBJECT_INDEX_CAP];
static mut BUCKET_SLOTS: [BucketSlot; AUTH_BUCKET_INDEX_CAP] =
    [BucketSlot::empty(); AUTH_BUCKET_INDEX_CAP];
static mut SUBJECT_SOURCE_SLOTS: [SubjectSourceSlot; AUTH_SUBJECT_SOURCE_CAP] =
    [SubjectSourceSlot::empty(); AUTH_SUBJECT_SOURCE_CAP];
static mut GRANT_COUNT: usize = 0;
static mut LAST_ERROR: i32 = AUTH_OK;

fn normalize_mask(mask: i32) -> i32 {
    mask & (AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN)
}

fn mix32(mut value: u32) -> u32 {
    value ^= value >> 16;
    value = value.wrapping_mul(0x7feb352d);
    value ^= value >> 15;
    value = value.wrapping_mul(0x846ca68b);
    value ^= value >> 16;
    value
}

fn hash1(a: i32) -> u32 {
    mix32((a as u32) ^ 0x9e3779b9)
}

fn hash2(a: i32, b: i32) -> u32 {
    mix32(hash1(a) ^ (b as u32).wrapping_mul(0x85ebca6b))
}

fn hash3(a: i32, b: i32, c: i32) -> u32 {
    mix32(hash2(a, b) ^ (c as u32).wrapping_mul(0xc2b2ae35))
}

unsafe fn set_error(code: i32) {
    LAST_ERROR = code;
}

fn key_attached_value(grant: Grant) -> i32 {
    if grant.source != AUTH_SOURCE_IDENTITY_BUNDLE || grant.requires_key == 0 || grant.key_attached != 0 {
        1
    } else {
        0
    }
}

fn self_usable(grant: Grant, ts: i64) -> bool {
    grant.used != 0
        && grant.revoked == 0
        && ts >= grant.not_before_ts
        && ts < grant.expires_ts
        && key_attached_value(grant) != 0
}

unsafe fn find_id_slot(grant_id: i32) -> i32 {
    let mut idx = (hash1(grant_id) as usize) & (AUTH_ID_INDEX_CAP - 1);
    let mut probe = 0usize;
    while probe < AUTH_ID_INDEX_CAP {
        let slot = ID_SLOTS[idx];
        if slot.used == 0 {
            return -1;
        }
        if slot.grant_id == grant_id {
            return idx as i32;
        }
        idx = (idx + 1) & (AUTH_ID_INDEX_CAP - 1);
        probe += 1;
    }
    -1
}

unsafe fn lookup_index(grant_id: i32) -> i32 {
    let slot = find_id_slot(grant_id);
    if slot < 0 {
        -1
    } else {
        ID_SLOTS[slot as usize].index
    }
}

unsafe fn insert_id_slot(grant_id: i32, index: i32) -> bool {
    let mut idx = (hash1(grant_id) as usize) & (AUTH_ID_INDEX_CAP - 1);
    let mut probe = 0usize;
    while probe < AUTH_ID_INDEX_CAP {
        let slot = &mut ID_SLOTS[idx];
        if slot.used == 0 {
            slot.used = 1;
            slot.grant_id = grant_id;
            slot.index = index;
            return true;
        }
        if slot.grant_id == grant_id {
            return false;
        }
        idx = (idx + 1) & (AUTH_ID_INDEX_CAP - 1);
        probe += 1;
    }
    false
}

unsafe fn get_subject_slot(subject_id: i32, create: bool) -> *mut SubjectSlot {
    let mut idx = (hash1(subject_id) as usize) & (AUTH_SUBJECT_INDEX_CAP - 1);
    let mut probe = 0usize;
    while probe < AUTH_SUBJECT_INDEX_CAP {
        let slot = &mut SUBJECT_SLOTS[idx];
        if slot.used == 0 {
            if !create {
                return core::ptr::null_mut();
            }
            slot.used = 1;
            slot.subject_id = subject_id;
            slot.bundle_count = 0;
            return slot;
        }
        if slot.subject_id == subject_id {
            return slot;
        }
        idx = (idx + 1) & (AUTH_SUBJECT_INDEX_CAP - 1);
        probe += 1;
    }
    core::ptr::null_mut()
}

unsafe fn get_bucket_slot(subject_id: i32, source: i32, resource_id: i32, create: bool) -> *mut BucketSlot {
    let mut idx = (hash3(subject_id, source, resource_id) as usize) & (AUTH_BUCKET_INDEX_CAP - 1);
    let mut probe = 0usize;
    while probe < AUTH_BUCKET_INDEX_CAP {
        let slot = &mut BUCKET_SLOTS[idx];
        if slot.used == 0 {
            if !create {
                return core::ptr::null_mut();
            }
            slot.used = 1;
            slot.subject_id = subject_id;
            slot.source = source;
            slot.resource_id = resource_id;
            slot.head = -1;
            return slot;
        }
        if slot.subject_id == subject_id && slot.source == source && slot.resource_id == resource_id {
            return slot;
        }
        idx = (idx + 1) & (AUTH_BUCKET_INDEX_CAP - 1);
        probe += 1;
    }
    core::ptr::null_mut()
}

unsafe fn get_subject_source_slot(subject_id: i32, source: i32, create: bool) -> *mut SubjectSourceSlot {
    let mut idx = (hash2(subject_id, source) as usize) & (AUTH_SUBJECT_SOURCE_CAP - 1);
    let mut probe = 0usize;
    while probe < AUTH_SUBJECT_SOURCE_CAP {
        let slot = &mut SUBJECT_SOURCE_SLOTS[idx];
        if slot.used == 0 {
            if !create {
                return core::ptr::null_mut();
            }
            slot.used = 1;
            slot.subject_id = subject_id;
            slot.source = source;
            slot.head = -1;
            return slot;
        }
        if slot.subject_id == subject_id && slot.source == source {
            return slot;
        }
        idx = (idx + 1) & (AUTH_SUBJECT_SOURCE_CAP - 1);
        probe += 1;
    }
    core::ptr::null_mut()
}

unsafe fn effective_mask_for_index(index: i32, ts: i64) -> i32 {
    let mut mask = AUTH_PERM_READ | AUTH_PERM_WRITE | AUTH_PERM_ADMIN;
    let mut current = index;
    while current >= 0 {
        let grant = GRANTS[current as usize];
        if !self_usable(grant, ts) {
            return 0;
        }
        mask &= normalize_mask(grant.stored_mask);
        current = grant.parent_index;
    }
    mask
}

unsafe fn disabled_by_ancestor(index: i32, ts: i64) -> i32 {
    let mut parent = GRANTS[index as usize].parent_index;
    while parent >= 0 {
        if !self_usable(GRANTS[parent as usize], ts) {
            return 1;
        }
        parent = GRANTS[parent as usize].parent_index;
    }
    0
}

unsafe fn select_source_for_subject(subject_id: i32, resolve_mode: i32) -> i32 {
    if resolve_mode == AUTH_MODE_LOCAL_ONLY {
        return AUTH_SOURCE_LOCAL_PROFILE;
    }
    if resolve_mode == AUTH_MODE_BUNDLE_ONLY {
        return AUTH_SOURCE_IDENTITY_BUNDLE;
    }
    let subject = get_subject_slot(subject_id, false);
    if !subject.is_null() && (*subject).bundle_count > 0 {
        AUTH_SOURCE_IDENTITY_BUNDLE
    } else {
        AUTH_SOURCE_LOCAL_PROFILE
    }
}

unsafe fn register_grant_indices(index: i32) -> bool {
    let grant = GRANTS[index as usize];
    if !insert_id_slot(grant.id, index) {
        return false;
    }
    let bucket = get_bucket_slot(grant.subject_id, grant.source, grant.resource_id, true);
    let subject_source = get_subject_source_slot(grant.subject_id, grant.source, true);
    if bucket.is_null() || subject_source.is_null() {
        return false;
    }
    GRANTS[index as usize].next_bucket = (*bucket).head;
    (*bucket).head = index;
    GRANTS[index as usize].next_subject_source = (*subject_source).head;
    (*subject_source).head = index;
    if grant.source == AUTH_SOURCE_IDENTITY_BUNDLE {
        let subject = get_subject_slot(grant.subject_id, true);
        if subject.is_null() {
            return false;
        }
        (*subject).bundle_count += 1;
    }
    true
}

unsafe fn alloc_index() -> i32 {
    if GRANT_COUNT >= AUTH_MAX_GRANTS {
        -1
    } else {
        let index = GRANT_COUNT as i32;
        GRANT_COUNT += 1;
        index
    }
}

unsafe fn write_grant(
    index: i32,
    grant_id: i32,
    parent_index: i32,
    subject_id: i32,
    resource_id: i32,
    source: i32,
    perms_mask: i32,
    not_before_ts: i64,
    expires_ts: i64,
    delegatable: i32,
    requires_key: i32,
) -> bool {
    GRANTS[index as usize] = Grant {
        used: 1,
        id: grant_id,
        parent_index,
        subject_id,
        resource_id,
        source,
        stored_mask: normalize_mask(perms_mask),
        delegatable: if delegatable != 0 { 1 } else { 0 },
        requires_key: if source == AUTH_SOURCE_IDENTITY_BUNDLE && requires_key != 0 {
            1
        } else {
            0
        },
        key_attached: 1,
        revoked: 0,
        next_bucket: -1,
        next_subject_source: -1,
        not_before_ts,
        expires_ts,
    };
    if GRANTS[index as usize].requires_key != 0 {
        GRANTS[index as usize].key_attached = 0;
    }
    register_grant_indices(index)
}

#[no_mangle]
pub unsafe extern "C" fn auth_reset() {
    let mut i = 0usize;
    while i < AUTH_MAX_GRANTS {
        GRANTS[i] = Grant::empty();
        i += 1;
    }
    i = 0;
    while i < AUTH_ID_INDEX_CAP {
        ID_SLOTS[i] = IdSlot::empty();
        i += 1;
    }
    i = 0;
    while i < AUTH_SUBJECT_INDEX_CAP {
        SUBJECT_SLOTS[i] = SubjectSlot::empty();
        i += 1;
    }
    i = 0;
    while i < AUTH_BUCKET_INDEX_CAP {
        BUCKET_SLOTS[i] = BucketSlot::empty();
        i += 1;
    }
    i = 0;
    while i < AUTH_SUBJECT_SOURCE_CAP {
        SUBJECT_SOURCE_SLOTS[i] = SubjectSourceSlot::empty();
        i += 1;
    }
    GRANT_COUNT = 0;
    LAST_ERROR = AUTH_OK;
}

#[no_mangle]
pub unsafe extern "C" fn auth_create_local_grant(
    grant_id: i32,
    subject_id: i32,
    resource_id: i32,
    perms_mask: i32,
    not_before_ts: i64,
    expires_ts: i64,
    delegatable: i32,
) -> i32 {
    if lookup_index(grant_id) >= 0 {
        set_error(AUTH_ERR_DUPLICATE_ID);
        return 0;
    }
    let index = alloc_index();
    if index < 0 {
        set_error(AUTH_ERR_CAPACITY);
        return 0;
    }
    if !write_grant(
        index,
        grant_id,
        -1,
        subject_id,
        resource_id,
        AUTH_SOURCE_LOCAL_PROFILE,
        perms_mask,
        not_before_ts,
        expires_ts,
        delegatable,
        0,
    ) {
        set_error(AUTH_ERR_CAPACITY);
        return 0;
    }
    set_error(AUTH_OK);
    1
}

#[no_mangle]
pub unsafe extern "C" fn auth_import_bundle_grant(
    grant_id: i32,
    subject_id: i32,
    resource_id: i32,
    perms_mask: i32,
    not_before_ts: i64,
    expires_ts: i64,
    delegatable: i32,
    requires_key: i32,
) -> i32 {
    if lookup_index(grant_id) >= 0 {
        set_error(AUTH_ERR_DUPLICATE_ID);
        return 0;
    }
    let index = alloc_index();
    if index < 0 {
        set_error(AUTH_ERR_CAPACITY);
        return 0;
    }
    if !write_grant(
        index,
        grant_id,
        -1,
        subject_id,
        resource_id,
        AUTH_SOURCE_IDENTITY_BUNDLE,
        perms_mask,
        not_before_ts,
        expires_ts,
        delegatable,
        requires_key,
    ) {
        set_error(AUTH_ERR_CAPACITY);
        return 0;
    }
    set_error(AUTH_OK);
    1
}

#[no_mangle]
pub unsafe extern "C" fn auth_attach_bundle_key(grant_id: i32) -> i32 {
    let index = lookup_index(grant_id);
    if index < 0 {
        set_error(AUTH_ERR_UNKNOWN_GRANT);
        return 0;
    }
    if GRANTS[index as usize].source != AUTH_SOURCE_IDENTITY_BUNDLE {
        set_error(AUTH_ERR_WRONG_SOURCE);
        return 0;
    }
    GRANTS[index as usize].key_attached = 1;
    set_error(AUTH_OK);
    1
}

#[no_mangle]
pub unsafe extern "C" fn auth_delegate(
    parent_grant_id: i32,
    child_grant_id: i32,
    subject_id: i32,
    resource_id: i32,
    perms_mask: i32,
    not_before_ts: i64,
    expires_ts: i64,
    delegatable: i32,
    requires_key: i32,
) -> i32 {
    if lookup_index(child_grant_id) >= 0 {
        set_error(AUTH_ERR_DUPLICATE_ID);
        return 0;
    }
    let parent_index = lookup_index(parent_grant_id);
    if parent_index < 0 {
        set_error(AUTH_ERR_UNKNOWN_GRANT);
        return 0;
    }
    let parent = GRANTS[parent_index as usize];
    if parent.revoked != 0 {
        set_error(AUTH_ERR_PARENT_REVOKED);
        return 0;
    }
    if parent.delegatable == 0 {
        set_error(AUTH_ERR_PARENT_NOT_DELEGATABLE);
        return 0;
    }
    if not_before_ts < parent.not_before_ts {
        set_error(AUTH_ERR_CHILD_START_TOO_EARLY);
        return 0;
    }
    if expires_ts > parent.expires_ts {
        set_error(AUTH_ERR_CHILD_EXPIRES_TOO_LATE);
        return 0;
    }
    if (normalize_mask(perms_mask) & !normalize_mask(parent.stored_mask)) != 0 {
        set_error(AUTH_ERR_CHILD_MASK_WIDENS);
        return 0;
    }
    let child_index = alloc_index();
    if child_index < 0 {
        set_error(AUTH_ERR_CAPACITY);
        return 0;
    }
    if !write_grant(
        child_index,
        child_grant_id,
        parent_index,
        subject_id,
        resource_id,
        parent.source,
        perms_mask,
        not_before_ts,
        expires_ts,
        delegatable,
        if parent.source == AUTH_SOURCE_IDENTITY_BUNDLE {
            requires_key
        } else {
            0
        },
    ) {
        set_error(AUTH_ERR_CAPACITY);
        return 0;
    }
    set_error(AUTH_OK);
    1
}

#[no_mangle]
pub unsafe extern "C" fn auth_revoke(grant_id: i32) -> i32 {
    let index = lookup_index(grant_id);
    if index < 0 {
        set_error(AUTH_ERR_UNKNOWN_GRANT);
        return 0;
    }
    GRANTS[index as usize].revoked = 1;
    set_error(AUTH_OK);
    1
}

#[no_mangle]
pub unsafe extern "C" fn auth_check(
    subject_id: i32,
    resource_id: i32,
    perm_bit: i32,
    ts: i64,
    resolve_mode: i32,
) -> i32 {
    let requested = normalize_mask(perm_bit);
    if requested == 0 {
        set_error(AUTH_OK);
        return 0;
    }
    let source = select_source_for_subject(subject_id, resolve_mode);
    let bucket = get_bucket_slot(subject_id, source, resource_id, false);
    if bucket.is_null() {
        set_error(AUTH_OK);
        return 0;
    }
    let mut index = (*bucket).head;
    while index >= 0 {
        if (effective_mask_for_index(index, ts) & requested) == requested {
            set_error(AUTH_OK);
            return 1;
        }
        index = GRANTS[index as usize].next_bucket;
    }
    set_error(AUTH_OK);
    0
}

#[no_mangle]
pub unsafe extern "C" fn auth_effective_mask(grant_id: i32, ts: i64) -> i32 {
    let index = lookup_index(grant_id);
    if index < 0 {
        set_error(AUTH_ERR_UNKNOWN_GRANT);
        return 0;
    }
    set_error(AUTH_OK);
    effective_mask_for_index(index, ts)
}

#[no_mangle]
pub unsafe extern "C" fn auth_audit_get(
    grant_id: i32,
    ts: i64,
    out_view: *mut AuthAuditView,
) -> i32 {
    if out_view.is_null() {
        set_error(AUTH_ERR_OUT_PARAM);
        return 0;
    }
    let index = lookup_index(grant_id);
    if index < 0 {
        *out_view = AuthAuditView {
            exists: 0,
            source: 0,
            stored_mask: 0,
            effective_mask: 0,
            revoked: 0,
            requires_key: 0,
            key_attached: 0,
            not_yet_valid: 0,
            expired: 0,
            disabled_by_ancestor: 0,
            usable: 0,
        };
        set_error(AUTH_ERR_UNKNOWN_GRANT);
        return 0;
    }
    let grant = GRANTS[index as usize];
    *out_view = AuthAuditView {
        exists: 1,
        source: grant.source,
        stored_mask: normalize_mask(grant.stored_mask),
        effective_mask: effective_mask_for_index(index, ts),
        revoked: if grant.revoked != 0 { 1 } else { 0 },
        requires_key: if grant.source == AUTH_SOURCE_IDENTITY_BUNDLE && grant.requires_key != 0 {
            1
        } else {
            0
        },
        key_attached: key_attached_value(grant),
        not_yet_valid: if ts < grant.not_before_ts { 1 } else { 0 },
        expired: if ts >= grant.expires_ts { 1 } else { 0 },
        disabled_by_ancestor: disabled_by_ancestor(index, ts),
        usable: 0,
    };
    (*out_view).usable = if (*out_view).effective_mask != 0 { 1 } else { 0 };
    set_error(AUTH_OK);
    1
}

#[no_mangle]
pub unsafe extern "C" fn auth_count_usable(subject_id: i32, ts: i64, resolve_mode: i32) -> i32 {
    let source = select_source_for_subject(subject_id, resolve_mode);
    let slot = get_subject_source_slot(subject_id, source, false);
    if slot.is_null() {
        set_error(AUTH_OK);
        return 0;
    }
    let mut count = 0;
    let mut index = (*slot).head;
    while index >= 0 {
        if effective_mask_for_index(index, ts) != 0 {
            count += 1;
        }
        index = GRANTS[index as usize].next_subject_source;
    }
    set_error(AUTH_OK);
    count
}

#[no_mangle]
pub unsafe extern "C" fn auth_last_error() -> i32 {
    LAST_ERROR
}
