use std::sync::{LazyLock, Mutex};
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
#[derive(Clone, Default)]
struct Session {
    id: i32,
    subject_id: i32,
    resource_id: i32,
    active_generation: i32,
    staged_generation: i32,
    grace_generation: i32,
    revoked: bool,
    revoked_generations: Vec<i32>,
    grace_until_ts: i64,
}
#[derive(Clone, Default)]
struct Credential {
    id: i32,
    session_id: i32,
    generation: i32,
    issued_ts: i64,
    expires_ts: i64,
}
#[derive(Default)]
struct State {
    sessions: Vec<Session>,
    credentials: Vec<Credential>,
    last_error: i32,
}
static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| Mutex::new(State::default()));
#[no_mangle]
pub extern "C" fn session_reset() {
    *STATE.lock().expect("lock") = State::default();
}
#[no_mangle]
pub extern "C" fn session_create(
    session_id: i32,
    subject_id: i32,
    resource_id: i32,
    active_generation: i32,
) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if s.sessions.iter().any(|x| x.id == session_id) {
        s.last_error = 1;
        return 0;
    }
    s.sessions.push(Session {
        id: session_id,
        subject_id,
        resource_id,
        active_generation,
        ..Default::default()
    });
    1
}
#[no_mangle]
pub extern "C" fn session_issue_credential(
    credential_id: i32,
    session_id: i32,
    generation: i32,
    issued_ts: i64,
    expires_ts: i64,
) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if s.credentials.iter().any(|c| c.id == credential_id) {
        s.last_error = 1;
        return 0;
    }
    if !s.sessions.iter().any(|x| x.id == session_id) {
        s.last_error = 2;
        return 0;
    }
    s.credentials.push(Credential {
        id: credential_id,
        session_id,
        generation,
        issued_ts,
        expires_ts,
    });
    1
}
#[no_mangle]
pub extern "C" fn session_stage_generation(
    session_id: i32,
    generation: i32,
    grace_until_ts: i64,
) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if let Some(x) = s.sessions.iter_mut().find(|x| x.id == session_id) {
        x.staged_generation = generation;
        x.grace_until_ts = grace_until_ts;
        1
    } else {
        s.last_error = 2;
        0
    }
}
#[no_mangle]
pub extern "C" fn session_activate_generation(session_id: i32, _ts: i64) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if let Some(x) = s.sessions.iter_mut().find(|x| x.id == session_id) {
        if x.staged_generation == 0 {
            s.last_error = 2;
            return 0;
        }
        x.grace_generation = x.active_generation;
        x.active_generation = x.staged_generation;
        x.staged_generation = 0;
        1
    } else {
        s.last_error = 2;
        0
    }
}
#[no_mangle]
pub extern "C" fn session_revoke(session_id: i32, generation: i32) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if let Some(x) = s.sessions.iter_mut().find(|x| x.id == session_id) {
        if generation < 0 {
            x.revoked = true;
        } else {
            x.revoked_generations.push(generation);
        }
        1
    } else {
        s.last_error = 2;
        0
    }
}
fn check_inner(s: &State, session_id: i32, generation: i32, ts: i64) -> bool {
    let Some(session) = s.sessions.iter().find(|x| x.id == session_id) else {
        return false;
    };
    if session.revoked || session.revoked_generations.contains(&generation) {
        return false;
    }
    let cred = s
        .credentials
        .iter()
        .filter(|c| c.session_id == session_id && c.generation == generation && ts < c.expires_ts)
        .max_by_key(|c| c.issued_ts);
    if cred.is_none() {
        return false;
    }
    generation == session.active_generation
        || (generation == session.grace_generation && ts < session.grace_until_ts)
}
#[no_mangle]
pub extern "C" fn session_check(session_id: i32, generation: i32, ts: i64) -> i32 {
    if check_inner(&STATE.lock().expect("lock"), session_id, generation, ts) {
        1
    } else {
        0
    }
}
#[no_mangle]
pub extern "C" fn session_audit_get(
    session_id: i32,
    generation: i32,
    ts: i64,
    out_view: *mut SessionAuditView,
) -> i32 {
    if out_view.is_null() {
        STATE.lock().expect("lock").last_error = 3;
        return 0;
    }
    let s = STATE.lock().expect("lock");
    let Some(session) = s.sessions.iter().find(|x| x.id == session_id) else {
        drop(s);
        STATE.lock().expect("lock").last_error = 2;
        return 0;
    };
    let view = SessionAuditView {
        exists: 1,
        session_revoked: session.revoked as i32,
        active_generation: session.active_generation,
        staged_generation: session.staged_generation,
        presented_generation: generation,
        grace_generation: session.grace_generation,
        grace_active: (generation == session.grace_generation && ts < session.grace_until_ts)
            as i32,
        generation_revoked: session.revoked_generations.contains(&generation) as i32,
        compatible: (generation == session.active_generation
            || (generation == session.grace_generation && ts < session.grace_until_ts))
            as i32,
        usable: check_inner(&s, session_id, generation, ts) as i32,
    };
    unsafe {
        *out_view = view;
    }
    drop(s);
    STATE.lock().expect("lock").last_error = 0;
    1
}
#[no_mangle]
pub extern "C" fn session_count_active(subject_id: i32, ts: i64) -> i32 {
    let s = STATE.lock().expect("lock");
    s.sessions
        .iter()
        .filter(|x| x.subject_id == subject_id && check_inner(&s, x.id, x.active_generation, ts))
        .count() as i32
}
#[no_mangle]
pub extern "C" fn session_last_error() -> i32 {
    STATE.lock().expect("lock").last_error
}
