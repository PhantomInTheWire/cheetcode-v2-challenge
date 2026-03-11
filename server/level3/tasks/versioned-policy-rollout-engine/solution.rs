use std::sync::{LazyLock, Mutex};

const POLICY_OK: i32 = 0;
const POLICY_ERR_DUPLICATE: i32 = 1;
const POLICY_ERR_UNKNOWN_SUBJECT: i32 = 2;
const POLICY_ERR_UNKNOWN_SNAPSHOT: i32 = 3;
const POLICY_ERR_OUT: i32 = 4;

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

#[derive(Clone, Default)]
struct Snapshot {
    id: i32,
    version: i32,
    subject_id: i32,
    resource_id: i32,
    allow_mask: i32,
    deny_mask: i32,
    priority: i32,
    retired: bool,
    disabled: bool,
    not_before_ts: i64,
    expires_ts: i64,
}

#[derive(Clone, Default)]
struct Binding {
    subject_id: i32,
    active_version: i32,
    fallback_version: i32,
    staged_version: i32,
}

#[derive(Default)]
struct State {
    snapshots: Vec<Snapshot>,
    bindings: Vec<Binding>,
    last_error: i32,
}

static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| Mutex::new(State::default()));

fn find_binding<'a>(state: &'a mut State, subject_id: i32) -> Option<&'a mut Binding> {
    state
        .bindings
        .iter_mut()
        .find(|b| b.subject_id == subject_id)
}

fn best_snapshot(
    state: &State,
    subject_id: i32,
    resource_id: i32,
    version: i32,
    ts: i64,
) -> Option<&Snapshot> {
    state
        .snapshots
        .iter()
        .filter(|s| {
            s.subject_id == subject_id
                && s.resource_id == resource_id
                && s.version == version
                && !s.retired
                && !s.disabled
                && ts >= s.not_before_ts
                && ts < s.expires_ts
        })
        .max_by_key(|s| (s.priority, s.id))
}

#[no_mangle]
pub extern "C" fn policy_reset() {
    *STATE.lock().expect("lock") = State::default();
}

#[no_mangle]
pub extern "C" fn policy_publish_snapshot(
    snapshot_id: i32,
    version: i32,
    subject_id: i32,
    resource_id: i32,
    allow_mask: i32,
    deny_mask: i32,
    priority: i32,
    not_before_ts: i64,
    expires_ts: i64,
) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if state.snapshots.iter().any(|s| s.id == snapshot_id) {
        state.last_error = POLICY_ERR_DUPLICATE;
        return 0;
    }
    state.snapshots.push(Snapshot {
        id: snapshot_id,
        version,
        subject_id,
        resource_id,
        allow_mask,
        deny_mask,
        priority,
        retired: false,
        disabled: false,
        not_before_ts,
        expires_ts,
    });
    state.last_error = POLICY_OK;
    1
}

#[no_mangle]
pub extern "C" fn policy_set_subject_binding(
    subject_id: i32,
    active_version: i32,
    fallback_version: i32,
) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if let Some(binding) = find_binding(&mut state, subject_id) {
        binding.active_version = active_version;
        binding.fallback_version = fallback_version;
    } else {
        state.bindings.push(Binding {
            subject_id,
            active_version,
            fallback_version,
            staged_version: 0,
        });
    }
    state.last_error = POLICY_OK;
    1
}

#[no_mangle]
pub extern "C" fn policy_stage_version(subject_id: i32, staged_version: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if let Some(binding) = find_binding(&mut state, subject_id) {
        binding.staged_version = staged_version;
        state.last_error = POLICY_OK;
        1
    } else {
        state.last_error = POLICY_ERR_UNKNOWN_SUBJECT;
        0
    }
}

#[no_mangle]
pub extern "C" fn policy_activate_version(subject_id: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if let Some(binding) = find_binding(&mut state, subject_id) {
        if binding.staged_version == 0 {
            state.last_error = POLICY_ERR_UNKNOWN_SUBJECT;
            return 0;
        }
        binding.fallback_version = binding.active_version;
        binding.active_version = binding.staged_version;
        binding.staged_version = 0;
        state.last_error = POLICY_OK;
        1
    } else {
        state.last_error = POLICY_ERR_UNKNOWN_SUBJECT;
        0
    }
}

#[no_mangle]
pub extern "C" fn policy_retire_snapshot(snapshot_id: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if let Some(snapshot) = state.snapshots.iter_mut().find(|s| s.id == snapshot_id) {
        snapshot.retired = true;
        state.last_error = POLICY_OK;
        1
    } else {
        state.last_error = POLICY_ERR_UNKNOWN_SNAPSHOT;
        0
    }
}

#[no_mangle]
pub extern "C" fn policy_disable_snapshot(snapshot_id: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if let Some(snapshot) = state.snapshots.iter_mut().find(|s| s.id == snapshot_id) {
        snapshot.disabled = true;
        state.last_error = POLICY_OK;
        1
    } else {
        state.last_error = POLICY_ERR_UNKNOWN_SNAPSHOT;
        0
    }
}

#[no_mangle]
pub extern "C" fn policy_check(subject_id: i32, resource_id: i32, perm_bit: i32, ts: i64) -> i32 {
    let state = STATE.lock().expect("lock");
    let Some(binding) = state.bindings.iter().find(|b| b.subject_id == subject_id) else {
        return 0;
    };
    let snapshot = best_snapshot(&state, subject_id, resource_id, binding.active_version, ts)
        .or_else(|| {
            best_snapshot(
                &state,
                subject_id,
                resource_id,
                binding.fallback_version,
                ts,
            )
        });
    let Some(snapshot) = snapshot else {
        return 0;
    };
    if snapshot.deny_mask & perm_bit != 0 {
        return 0;
    }
    if snapshot.allow_mask & perm_bit != 0 {
        1
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn policy_explain_get(
    subject_id: i32,
    resource_id: i32,
    perm_bit: i32,
    ts: i64,
    out_view: *mut PolicyExplainView,
) -> i32 {
    if out_view.is_null() {
        STATE.lock().expect("lock").last_error = POLICY_ERR_OUT;
        return 0;
    }
    let state = STATE.lock().expect("lock");
    let Some(binding) = state.bindings.iter().find(|b| b.subject_id == subject_id) else {
        return 0;
    };
    let mut decided_version = binding.active_version;
    let mut fallback_used = 0;
    let active = best_snapshot(&state, subject_id, resource_id, binding.active_version, ts);
    let snapshot = if active.is_some() {
        active
    } else {
        let fb = best_snapshot(
            &state,
            subject_id,
            resource_id,
            binding.fallback_version,
            ts,
        );
        if fb.is_some() {
            decided_version = binding.fallback_version;
            fallback_used = 1;
        }
        fb
    };
    let stale_snapshot = state.snapshots.iter().any(|s| {
        s.subject_id == subject_id
            && s.resource_id == resource_id
            && s.version == binding.active_version
            && !s.retired
            && !s.disabled
            && (ts < s.not_before_ts || ts >= s.expires_ts)
    }) as i32;
    let disabled_snapshot = state.snapshots.iter().any(|s| {
        s.subject_id == subject_id
            && s.resource_id == resource_id
            && s.version == binding.active_version
            && (s.retired || s.disabled)
    }) as i32;
    let mut view = PolicyExplainView {
        exists: 1,
        matched_snapshot_id: 0,
        decided_version,
        allow_mask: 0,
        deny_mask: 0,
        fallback_used,
        stale_snapshot,
        disabled_snapshot,
        usable: 0,
    };
    if let Some(snapshot) = snapshot {
        view.matched_snapshot_id = snapshot.id;
        view.allow_mask = snapshot.allow_mask;
        view.deny_mask = snapshot.deny_mask;
        view.usable =
            ((snapshot.allow_mask & perm_bit) != 0 && (snapshot.deny_mask & perm_bit) == 0) as i32;
    }
    unsafe {
        *out_view = view;
    }
    1
}

#[no_mangle]
pub extern "C" fn policy_count_subject_rules(subject_id: i32, ts: i64) -> i32 {
    let state = STATE.lock().expect("lock");
    let Some(binding) = state.bindings.iter().find(|b| b.subject_id == subject_id) else {
        return 0;
    };
    state
        .snapshots
        .iter()
        .filter(|s| {
            s.subject_id == subject_id
                && !s.retired
                && !s.disabled
                && ts >= s.not_before_ts
                && ts < s.expires_ts
                && (s.version == binding.active_version || s.version == binding.fallback_version)
        })
        .count() as i32
}

#[no_mangle]
pub extern "C" fn policy_last_error() -> i32 {
    STATE.lock().expect("lock").last_error
}
