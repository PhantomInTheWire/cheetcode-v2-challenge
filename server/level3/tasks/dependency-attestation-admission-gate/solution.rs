use std::sync::{LazyLock, Mutex};
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
#[derive(Clone, Default)]
struct Service {
    id: i32,
    blocked: bool,
    deps: Vec<i32>,
    rollout: [i32; 8],
}
#[derive(Clone, Default)]
struct Attestation {
    service_id: i32,
    environment_id: i32,
    status: i32,
    observed_ts: i64,
    valid_until_ts: i64,
}
#[derive(Clone, Default)]
struct Waiver {
    service_id: i32,
    environment_id: i32,
    valid_until_ts: i64,
}
#[derive(Default)]
struct State {
    services: Vec<Service>,
    attestations: Vec<Attestation>,
    waivers: Vec<Waiver>,
    last_error: i32,
}
static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| Mutex::new(State::default()));
fn env_slot(env: i32) -> usize {
    (env & 7) as usize
}
fn waiver_active(state: &State, service_id: i32, env: i32, ts: i64) -> bool {
    state
        .waivers
        .iter()
        .any(|w| w.service_id == service_id && w.environment_id == env && ts < w.valid_until_ts)
}
fn flags(state: &State, service_id: i32, env: i32, ts: i64) -> (bool, bool, bool) {
    let mut h = false;
    let mut u = false;
    let mut stale = false;
    for a in &state.attestations {
        if a.service_id != service_id || a.environment_id != env {
            continue;
        }
        if ts >= a.valid_until_ts {
            if a.status == 1 {
                stale = true;
            }
            continue;
        }
        if a.status == 1 {
            h = true;
        } else {
            u = true;
        }
    }
    (h, u, stale)
}
fn admissible(state: &State, service_id: i32, env: i32, ts: i64, seen: &mut Vec<i32>) -> bool {
    let Some(service) = state.services.iter().find(|s| s.id == service_id) else {
        return false;
    };
    if service.rollout[env_slot(env)] == 0 || service.blocked {
        return false;
    }
    if seen.contains(&service_id) {
        return true;
    }
    seen.push(service_id);
    for dep in &service.deps {
        if !admissible(state, *dep, env, ts, seen) {
            return false;
        }
    }
    let (healthy, unhealthy, _) = flags(state, service_id, env, ts);
    if healthy && unhealthy {
        return false;
    }
    healthy || waiver_active(state, service_id, env, ts)
}
#[no_mangle]
pub extern "C" fn gate_reset() {
    *STATE.lock().expect("lock") = State::default();
}
#[no_mangle]
pub extern "C" fn gate_register_service(service_id: i32) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if s.services.iter().any(|x| x.id == service_id) {
        s.last_error = 1;
        return 0;
    }
    s.services.push(Service {
        id: service_id,
        ..Default::default()
    });
    1
}
#[no_mangle]
pub extern "C" fn gate_set_dependency(service_id: i32, dependency_id: i32) -> i32 {
    let mut s = STATE.lock().expect("lock");
    let dep_exists = s.services.iter().any(|x| x.id == dependency_id);
    if !dep_exists {
        s.last_error = 2;
        return 0;
    }
    if let Some(svc) = s.services.iter_mut().find(|x| x.id == service_id) {
        svc.deps.push(dependency_id);
        1
    } else {
        s.last_error = 2;
        0
    }
}
#[no_mangle]
pub extern "C" fn gate_report_attestation(
    service_id: i32,
    environment_id: i32,
    status: i32,
    observed_ts: i64,
    valid_until_ts: i64,
) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if !s.services.iter().any(|x| x.id == service_id) {
        s.last_error = 2;
        return 0;
    }
    s.attestations.push(Attestation {
        service_id,
        environment_id,
        status,
        observed_ts,
        valid_until_ts,
    });
    1
}
#[no_mangle]
pub extern "C" fn gate_set_environment_rollout(
    service_id: i32,
    environment_id: i32,
    enabled: i32,
) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if let Some(x) = s.services.iter_mut().find(|x| x.id == service_id) {
        x.rollout[env_slot(environment_id)] = enabled;
        1
    } else {
        s.last_error = 2;
        0
    }
}
#[no_mangle]
pub extern "C" fn gate_add_waiver(
    service_id: i32,
    environment_id: i32,
    valid_until_ts: i64,
) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if !s.services.iter().any(|x| x.id == service_id) {
        s.last_error = 2;
        return 0;
    }
    s.waivers.push(Waiver {
        service_id,
        environment_id,
        valid_until_ts,
    });
    1
}
#[no_mangle]
pub extern "C" fn gate_block_service(service_id: i32, blocked: i32) -> i32 {
    let mut s = STATE.lock().expect("lock");
    if let Some(x) = s.services.iter_mut().find(|x| x.id == service_id) {
        x.blocked = blocked != 0;
        1
    } else {
        s.last_error = 2;
        0
    }
}
#[no_mangle]
pub extern "C" fn gate_check_admission(service_id: i32, environment_id: i32, ts: i64) -> i32 {
    if admissible(
        &STATE.lock().expect("lock"),
        service_id,
        environment_id,
        ts,
        &mut Vec::new(),
    ) {
        1
    } else {
        0
    }
}
#[no_mangle]
pub extern "C" fn gate_audit_get(
    service_id: i32,
    environment_id: i32,
    ts: i64,
    out_view: *mut GateAuditView,
) -> i32 {
    if out_view.is_null() {
        STATE.lock().expect("lock").last_error = 3;
        return 0;
    }
    let s = STATE.lock().expect("lock");
    let Some(service) = s.services.iter().find(|x| x.id == service_id) else {
        return 0;
    };
    let (healthy, unhealthy, stale) = flags(&s, service_id, environment_id, ts);
    let blocked_transitive = service
        .deps
        .iter()
        .any(|dep| !admissible(&s, *dep, environment_id, ts, &mut vec![service_id]));
    let view = GateAuditView {
        exists: 1,
        rollout_enabled: service.rollout[env_slot(environment_id)],
        attested: healthy as i32,
        waiver_active: waiver_active(&s, service_id, environment_id, ts) as i32,
        blocked_direct: service.blocked as i32,
        blocked_transitive: blocked_transitive as i32,
        stale_attestation: stale as i32,
        conflicting_evidence: (healthy && unhealthy) as i32,
        admissible: admissible(&s, service_id, environment_id, ts, &mut Vec::new()) as i32,
    };
    unsafe {
        *out_view = view;
    }
    1
}
#[no_mangle]
pub extern "C" fn gate_count_admissible(environment_id: i32, ts: i64) -> i32 {
    let s = STATE.lock().expect("lock");
    s.services
        .iter()
        .filter(|svc| admissible(&s, svc.id, environment_id, ts, &mut Vec::new()))
        .count() as i32
}
#[no_mangle]
pub extern "C" fn gate_last_error() -> i32 {
    STATE.lock().expect("lock").last_error
}
