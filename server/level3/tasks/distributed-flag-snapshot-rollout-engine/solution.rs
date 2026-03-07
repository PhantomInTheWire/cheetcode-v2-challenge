use std::sync::{LazyLock, Mutex};

const FLAG_OK: i32 = 0;
const FLAG_ERR_DUP_FLAG: i32 = 1;
const FLAG_ERR_DUP_SNAPSHOT: i32 = 2;
const FLAG_ERR_DUP_TOMBSTONE: i32 = 3;
const FLAG_ERR_UNKNOWN_FLAG: i32 = 4;
const FLAG_ERR_UNKNOWN_SNAPSHOT: i32 = 5;
const FLAG_ERR_BAD_ROLLOUT: i32 = 6;
const FLAG_ERR_UNKNOWN_BINDING: i32 = 7;
const FLAG_ERR_UNKNOWN_PREREQ_FLAG: i32 = 8;
const FLAG_ERR_PREREQ_CYCLE: i32 = 9;
const FLAG_ERR_OUT_PARAM: i32 = 10;

#[repr(C)]
#[derive(Clone, Copy, Default)]
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

#[derive(Clone)]
struct FlagDef {
    id: i32,
    default_variant_id: i32,
    off_variant_id: i32,
}

#[derive(Clone)]
struct Prerequisite {
    flag_id: i32,
    prerequisite_flag_id: i32,
    required_variant_id: i32,
}

#[derive(Clone)]
struct Snapshot {
    id: i32,
    flag_id: i32,
    environment_id: i32,
    version: i32,
    rule_id: i32,
    segment_id: i32,
    priority: i32,
    variant_id: i32,
    rollout_percent: i32,
    track_events: i32,
    not_before_ts: i64,
    expires_ts: i64,
    retired: bool,
    disabled: bool,
}

#[derive(Clone)]
struct Tombstone {
    id: i32,
    flag_id: i32,
    environment_id: i32,
    version: i32,
    not_before_ts: i64,
    expires_ts: i64,
}

#[derive(Clone, Default)]
struct Binding {
    flag_id: i32,
    environment_id: i32,
    has_active: bool,
    active_version: i32,
    has_staged: bool,
    staged_version: i32,
    has_fallback: bool,
    fallback_version: i32,
}

#[derive(Clone)]
struct ReplicaState {
    flag_id: i32,
    environment_id: i32,
    version: i32,
    stale: bool,
}

#[derive(Clone)]
struct SegmentMembership {
    subject_id: i32,
    segment_id: i32,
    member: bool,
}

#[derive(Default)]
struct State {
    flags: Vec<FlagDef>,
    prerequisites: Vec<Prerequisite>,
    snapshots: Vec<Snapshot>,
    tombstones: Vec<Tombstone>,
    bindings: Vec<Binding>,
    replicas: Vec<ReplicaState>,
    segments: Vec<SegmentMembership>,
    last_error: i32,
}

#[derive(Clone, Copy, Default)]
struct VersionFlags {
    version_exists: bool,
    any_usable_snapshot: bool,
    any_matching_snapshot: bool,
    any_disabled_snapshot: bool,
    any_tombstone: bool,
    replica_stale: bool,
}

#[derive(Clone, Copy)]
struct VersionResolution {
    version: i32,
    matched_snapshot_id: i32,
    matched_rule_id: i32,
    decided_variant_id: i32,
    off_by_targeting: i32,
    usable: i32,
    fallback_used: i32,
}

#[derive(Clone, Copy, Default)]
struct EvalResult {
    exists: bool,
    environment_id: i32,
    decided_version: i32,
    matched_snapshot_id: i32,
    matched_rule_id: i32,
    decided_variant_id: i32,
    fallback_used: i32,
    tombstone_blocked: i32,
    stale_active_seen: i32,
    disabled_active_seen: i32,
    prerequisite_failed: i32,
    off_by_targeting: i32,
    usable: i32,
}

static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| Mutex::new(State::default()));

fn set_error(state: &mut State, code: i32) {
    state.last_error = code;
}

fn flag_index(state: &State, flag_id: i32) -> Option<usize> {
    state.flags.iter().position(|flag| flag.id == flag_id)
}

fn get_flag(state: &State, flag_id: i32) -> Option<&FlagDef> {
    state.flags.iter().find(|flag| flag.id == flag_id)
}

fn binding_index(state: &State, flag_id: i32, environment_id: i32) -> Option<usize> {
    state
        .bindings
        .iter()
        .position(|binding| binding.flag_id == flag_id && binding.environment_id == environment_id)
}

fn binding_mut<'a>(state: &'a mut State, flag_id: i32, environment_id: i32) -> &'a mut Binding {
    if let Some(index) = binding_index(state, flag_id, environment_id) {
        &mut state.bindings[index]
    } else {
        state.bindings.push(Binding {
            flag_id,
            environment_id,
            ..Binding::default()
        });
        let idx = state.bindings.len() - 1;
        &mut state.bindings[idx]
    }
}

fn segment_member(state: &State, subject_id: i32, segment_id: i32) -> bool {
    if segment_id == 0 {
        return true;
    }
    state
        .segments
        .iter()
        .find(|entry| entry.subject_id == subject_id && entry.segment_id == segment_id)
        .map(|entry| entry.member)
        .unwrap_or(false)
}

fn tombstone_active(state: &State, flag_id: i32, environment_id: i32, version: i32, ts: i64) -> bool {
    state.tombstones.iter().any(|tombstone| {
        tombstone.flag_id == flag_id
            && tombstone.environment_id == environment_id
            && tombstone.version == version
            && ts >= tombstone.not_before_ts
            && ts < tombstone.expires_ts
    })
}

fn replica_stale(state: &State, flag_id: i32, environment_id: i32, version: i32) -> bool {
    state
        .replicas
        .iter()
        .find(|entry| {
            entry.flag_id == flag_id
                && entry.environment_id == environment_id
                && entry.version == version
        })
        .map(|entry| entry.stale)
        .unwrap_or(false)
}

fn snapshot_usable(snapshot: &Snapshot, ts: i64) -> bool {
    !snapshot.retired && !snapshot.disabled && ts >= snapshot.not_before_ts && ts < snapshot.expires_ts
}

fn snapshot_matches(
    state: &State,
    snapshot: &Snapshot,
    subject_id: i32,
    subject_bucket: i32,
    ts: i64,
) -> bool {
    snapshot_usable(snapshot, ts)
        && segment_member(state, subject_id, snapshot.segment_id)
        && subject_bucket >= 0
        && subject_bucket < snapshot.rollout_percent
}

fn better_snapshot(candidate: &Snapshot, best: &Snapshot) -> bool {
    if candidate.priority != best.priority {
        return candidate.priority > best.priority;
    }
    let candidate_specific = if candidate.segment_id > 0 { 1 } else { 0 };
    let best_specific = if best.segment_id > 0 { 1 } else { 0 };
    if candidate_specific != best_specific {
        return candidate_specific > best_specific;
    }
    if candidate.rule_id != best.rule_id {
        return candidate.rule_id < best.rule_id;
    }
    candidate.id < best.id
}

fn version_flags(state: &State, flag_id: i32, environment_id: i32, version: i32, subject_id: i32, subject_bucket: i32, ts: i64) -> VersionFlags {
    let mut flags = VersionFlags {
        replica_stale: replica_stale(state, flag_id, environment_id, version),
        any_tombstone: tombstone_active(state, flag_id, environment_id, version, ts),
        ..VersionFlags::default()
    };

    for snapshot in &state.snapshots {
        if snapshot.flag_id != flag_id
            || snapshot.environment_id != environment_id
            || snapshot.version != version
        {
            continue;
        }
        flags.version_exists = true;
        if snapshot.disabled || snapshot.retired {
            flags.any_disabled_snapshot = true;
        }
        if snapshot_usable(snapshot, ts) {
            flags.any_usable_snapshot = true;
            if snapshot_matches(state, snapshot, subject_id, subject_bucket, ts) {
                flags.any_matching_snapshot = true;
            }
        }
    }

    flags
}

fn resolve_version(
    state: &State,
    flag_id: i32,
    environment_id: i32,
    version: i32,
    subject_id: i32,
    subject_bucket: i32,
    ts: i64,
    fallback_used: i32,
) -> Option<VersionResolution> {
    let flags = version_flags(state, flag_id, environment_id, version, subject_id, subject_bucket, ts);
    if flags.replica_stale || flags.any_tombstone || !flags.any_usable_snapshot {
        return None;
    }

    let mut best: Option<&Snapshot> = None;
    for snapshot in &state.snapshots {
        if snapshot.flag_id != flag_id
            || snapshot.environment_id != environment_id
            || snapshot.version != version
        {
            continue;
        }
        if !snapshot_matches(state, snapshot, subject_id, subject_bucket, ts) {
            continue;
        }
        best = match best {
            Some(current) if !better_snapshot(snapshot, current) => Some(current),
            _ => Some(snapshot),
        };
    }

    if let Some(snapshot) = best {
        return Some(VersionResolution {
            version,
            matched_snapshot_id: snapshot.id,
            matched_rule_id: snapshot.rule_id,
            decided_variant_id: snapshot.variant_id,
            off_by_targeting: 0,
            usable: 1,
            fallback_used,
        });
    }

    let flag = get_flag(state, flag_id)?;
    Some(VersionResolution {
        version,
        matched_snapshot_id: 0,
        matched_rule_id: 0,
        decided_variant_id: flag.default_variant_id,
        off_by_targeting: 1,
        usable: 1,
        fallback_used,
    })
}

fn has_path(state: &State, target_flag_id: i32, start_flag_id: i32) -> bool {
    if target_flag_id == start_flag_id {
        return true;
    }
    let mut stack = vec![start_flag_id];
    let mut seen = Vec::new();
    while let Some(current) = stack.pop() {
        if current == target_flag_id {
            return true;
        }
        if seen.contains(&current) {
            continue;
        }
        seen.push(current);
        for prereq in &state.prerequisites {
            if prereq.flag_id == current {
                stack.push(prereq.prerequisite_flag_id);
            }
        }
    }
    false
}

fn evaluate_internal(
    state: &State,
    flag_id: i32,
    environment_id: i32,
    subject_id: i32,
    subject_bucket: i32,
    ts: i64,
    visiting: &mut Vec<i32>,
) -> EvalResult {
    let mut result = EvalResult {
        environment_id,
        ..EvalResult::default()
    };

    let Some(flag) = get_flag(state, flag_id) else {
        return result;
    };
    result.exists = true;
    result.decided_variant_id = flag.off_variant_id;

    let binding = binding_index(state, flag_id, environment_id).map(|idx| state.bindings[idx].clone());
    let Some(binding) = binding else {
        return result;
    };

    let active_flags = if binding.has_active {
        version_flags(
            state,
            flag_id,
            environment_id,
            binding.active_version,
            subject_id,
            subject_bucket,
            ts,
        )
    } else {
        VersionFlags::default()
    };
    result.stale_active_seen = if active_flags.replica_stale { 1 } else { 0 };
    result.disabled_active_seen = if active_flags.any_disabled_snapshot { 1 } else { 0 };

    let mut selected = None;
    if binding.has_active {
        selected = resolve_version(
            state,
            flag_id,
            environment_id,
            binding.active_version,
            subject_id,
            subject_bucket,
            ts,
            0,
        );
        if selected.is_none() && active_flags.any_tombstone {
            result.tombstone_blocked = 1;
        }
    }

    if selected.is_none() && binding.has_fallback {
        let fallback_flags = version_flags(
            state,
            flag_id,
            environment_id,
            binding.fallback_version,
            subject_id,
            subject_bucket,
            ts,
        );
        if fallback_flags.any_tombstone {
            result.tombstone_blocked = 1;
        } else {
            selected = resolve_version(
                state,
                flag_id,
                environment_id,
                binding.fallback_version,
                subject_id,
                subject_bucket,
                ts,
                1,
            );
        }
    }

    let Some(selection) = selected else {
        return result;
    };

    result.decided_version = selection.version;
    result.matched_snapshot_id = selection.matched_snapshot_id;
    result.matched_rule_id = selection.matched_rule_id;
    result.decided_variant_id = selection.decided_variant_id;
    result.off_by_targeting = selection.off_by_targeting;
    result.fallback_used = selection.fallback_used;
    result.usable = selection.usable;

    if visiting.contains(&flag_id) {
        result.prerequisite_failed = 1;
        result.decided_variant_id = flag.off_variant_id;
        return result;
    }

    visiting.push(flag_id);
    for prereq in state.prerequisites.iter().filter(|prereq| prereq.flag_id == flag_id) {
        let prereq_result = evaluate_internal(
            state,
            prereq.prerequisite_flag_id,
            environment_id,
            subject_id,
            subject_bucket,
            ts,
            visiting,
        );
        if !prereq_result.exists || prereq_result.decided_variant_id != prereq.required_variant_id {
            result.prerequisite_failed = 1;
            result.decided_variant_id = flag.off_variant_id;
            break;
        }
    }
    visiting.pop();

    result
}

#[no_mangle]
pub extern "C" fn flag_reset() {
    *STATE.lock().expect("lock") = State::default();
}

#[no_mangle]
pub extern "C" fn flag_define(flag_id: i32, default_variant_id: i32, off_variant_id: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if flag_index(&state, flag_id).is_some() {
        set_error(&mut state, FLAG_ERR_DUP_FLAG);
        return 0;
    }
    state.flags.push(FlagDef {
        id: flag_id,
        default_variant_id,
        off_variant_id,
    });
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_define_prerequisite(
    flag_id: i32,
    prerequisite_flag_id: i32,
    required_variant_id: i32,
) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() || get_flag(&state, prerequisite_flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_PREREQ_FLAG);
        return 0;
    }
    if has_path(&state, flag_id, prerequisite_flag_id) {
        set_error(&mut state, FLAG_ERR_PREREQ_CYCLE);
        return 0;
    }
    state.prerequisites.push(Prerequisite {
        flag_id,
        prerequisite_flag_id,
        required_variant_id,
    });
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_publish_snapshot(
    snapshot_id: i32,
    flag_id: i32,
    environment_id: i32,
    version: i32,
    rule_id: i32,
    segment_id: i32,
    priority: i32,
    variant_id: i32,
    rollout_percent: i32,
    track_events: i32,
    not_before_ts: i64,
    expires_ts: i64,
) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    if !(0..=100).contains(&rollout_percent) {
        set_error(&mut state, FLAG_ERR_BAD_ROLLOUT);
        return 0;
    }
    if state.snapshots.iter().any(|snapshot| snapshot.id == snapshot_id) {
        set_error(&mut state, FLAG_ERR_DUP_SNAPSHOT);
        return 0;
    }
    state.snapshots.push(Snapshot {
        id: snapshot_id,
        flag_id,
        environment_id,
        version,
        rule_id,
        segment_id,
        priority,
        variant_id,
        rollout_percent,
        track_events,
        not_before_ts,
        expires_ts,
        retired: false,
        disabled: false,
    });
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_publish_tombstone(
    tombstone_id: i32,
    flag_id: i32,
    environment_id: i32,
    version: i32,
    not_before_ts: i64,
    expires_ts: i64,
) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    if state.tombstones.iter().any(|tombstone| tombstone.id == tombstone_id) {
        set_error(&mut state, FLAG_ERR_DUP_TOMBSTONE);
        return 0;
    }
    state.tombstones.push(Tombstone {
        id: tombstone_id,
        flag_id,
        environment_id,
        version,
        not_before_ts,
        expires_ts,
    });
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_stage_version(flag_id: i32, environment_id: i32, version: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    let binding = binding_mut(&mut state, flag_id, environment_id);
    binding.has_staged = true;
    binding.staged_version = version;
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_activate_version(flag_id: i32, environment_id: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    let Some(index) = binding_index(&state, flag_id, environment_id) else {
        set_error(&mut state, FLAG_ERR_UNKNOWN_BINDING);
        return 0;
    };
    if !state.bindings[index].has_staged {
        set_error(&mut state, FLAG_ERR_UNKNOWN_BINDING);
        return 0;
    }
    let binding = &mut state.bindings[index];
    if binding.has_active {
        binding.has_fallback = true;
        binding.fallback_version = binding.active_version;
    }
    binding.has_active = true;
    binding.active_version = binding.staged_version;
    binding.has_staged = false;
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_set_fallback_version(flag_id: i32, environment_id: i32, version: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    let known_version = state.snapshots.iter().any(|snapshot| {
        snapshot.flag_id == flag_id
            && snapshot.environment_id == environment_id
            && snapshot.version == version
    }) || state.tombstones.iter().any(|tombstone| {
        tombstone.flag_id == flag_id
            && tombstone.environment_id == environment_id
            && tombstone.version == version
    }) || state.replicas.iter().any(|replica| {
        replica.flag_id == flag_id
            && replica.environment_id == environment_id
            && replica.version == version
    });
    if !known_version {
        set_error(&mut state, FLAG_ERR_UNKNOWN_BINDING);
        return 0;
    }
    let binding = binding_mut(&mut state, flag_id, environment_id);
    binding.has_fallback = true;
    binding.fallback_version = version;
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_disable_snapshot(snapshot_id: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    let Some(snapshot) = state.snapshots.iter_mut().find(|snapshot| snapshot.id == snapshot_id) else {
        set_error(&mut state, FLAG_ERR_UNKNOWN_SNAPSHOT);
        return 0;
    };
    snapshot.disabled = true;
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_retire_snapshot(snapshot_id: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    let Some(snapshot) = state.snapshots.iter_mut().find(|snapshot| snapshot.id == snapshot_id) else {
        set_error(&mut state, FLAG_ERR_UNKNOWN_SNAPSHOT);
        return 0;
    };
    snapshot.retired = true;
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_mark_replica_stale(
    flag_id: i32,
    environment_id: i32,
    version: i32,
    stale: i32,
) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    if let Some(entry) = state.replicas.iter_mut().find(|entry| {
        entry.flag_id == flag_id && entry.environment_id == environment_id && entry.version == version
    }) {
        entry.stale = stale != 0;
    } else {
        state.replicas.push(ReplicaState {
            flag_id,
            environment_id,
            version,
            stale: stale != 0,
        });
    }
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_register_segment_membership(subject_id: i32, segment_id: i32, member: i32) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if let Some(entry) = state
        .segments
        .iter_mut()
        .find(|entry| entry.subject_id == subject_id && entry.segment_id == segment_id)
    {
        entry.member = member != 0;
    } else {
        state.segments.push(SegmentMembership {
            subject_id,
            segment_id,
            member: member != 0,
        });
    }
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_evaluate(
    flag_id: i32,
    environment_id: i32,
    subject_id: i32,
    subject_bucket: i32,
    ts: i64,
) -> i32 {
    let mut state = STATE.lock().expect("lock");
    let result = evaluate_internal(
        &state,
        flag_id,
        environment_id,
        subject_id,
        subject_bucket,
        ts,
        &mut Vec::new(),
    );
    if !result.exists {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        0
    } else {
        set_error(&mut state, FLAG_OK);
        result.decided_variant_id
    }
}

#[no_mangle]
pub extern "C" fn flag_explain_get(
    flag_id: i32,
    environment_id: i32,
    subject_id: i32,
    subject_bucket: i32,
    ts: i64,
    out_view: *mut FlagEvalView,
) -> i32 {
    if out_view.is_null() {
        let mut state = STATE.lock().expect("lock");
        set_error(&mut state, FLAG_ERR_OUT_PARAM);
        return 0;
    }
    let mut state = STATE.lock().expect("lock");
    let result = evaluate_internal(
        &state,
        flag_id,
        environment_id,
        subject_id,
        subject_bucket,
        ts,
        &mut Vec::new(),
    );
    if !result.exists {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    let view = FlagEvalView {
        exists: 1,
        environment_id: result.environment_id,
        decided_version: result.decided_version,
        matched_snapshot_id: result.matched_snapshot_id,
        matched_rule_id: result.matched_rule_id,
        decided_variant_id: result.decided_variant_id,
        fallback_used: result.fallback_used,
        tombstone_blocked: result.tombstone_blocked,
        stale_active_seen: result.stale_active_seen,
        disabled_active_seen: result.disabled_active_seen,
        prerequisite_failed: result.prerequisite_failed,
        off_by_targeting: result.off_by_targeting,
        usable: result.usable,
    };
    // SAFETY: out_view is checked for null above and points to caller-owned storage.
    unsafe {
        *out_view = view;
    }
    set_error(&mut state, FLAG_OK);
    1
}

#[no_mangle]
pub extern "C" fn flag_count_usable_snapshots(flag_id: i32, environment_id: i32, ts: i64) -> i32 {
    let mut state = STATE.lock().expect("lock");
    if get_flag(&state, flag_id).is_none() {
        set_error(&mut state, FLAG_ERR_UNKNOWN_FLAG);
        return 0;
    }
    let Some(index) = binding_index(&state, flag_id, environment_id) else {
        set_error(&mut state, FLAG_OK);
        return 0;
    };
    let binding = state.bindings[index].clone();
    let mut versions = Vec::new();
    if binding.has_active {
        let active_flags = version_flags(&state, flag_id, environment_id, binding.active_version, 0, 0, ts);
        if !active_flags.replica_stale && !active_flags.any_tombstone {
            versions.push(binding.active_version);
        }
    }
    if binding.has_fallback && !versions.contains(&binding.fallback_version) {
        let fallback_flags =
            version_flags(&state, flag_id, environment_id, binding.fallback_version, 0, 0, ts);
        if !fallback_flags.replica_stale && !fallback_flags.any_tombstone {
            versions.push(binding.fallback_version);
        }
    }
    let count = state
        .snapshots
        .iter()
        .filter(|snapshot| {
            snapshot.flag_id == flag_id
                && snapshot.environment_id == environment_id
                && versions.contains(&snapshot.version)
                && snapshot_usable(snapshot, ts)
        })
        .count() as i32;
    set_error(&mut state, FLAG_OK);
    count
}

#[no_mangle]
pub extern "C" fn flag_last_error() -> i32 {
    STATE.lock().expect("lock").last_error
}
