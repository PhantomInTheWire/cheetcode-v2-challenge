use std::sync::{LazyLock, Mutex};

#[repr(C)]
pub struct CredAuditView { pub exists:i32, pub registry_kind:i32, pub cached:i32, pub expired:i32, pub client_error:i32, pub token_id:i32, pub refresh_count:i32, pub usable:i32 }
#[derive(Clone,Default)] struct Reg{ id:i32, kind:i32, token:i32, error:i32, refresh_count:i32, expiry:i64 }
#[derive(Default)] struct State{ regs:Vec<Reg>, last_error:i32 }
static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| Mutex::new(State::default()));

fn usable_kind(kind:i32) -> bool { kind == 1 || kind == 2 }
fn next_refresh_token(reg: &Reg) -> i32 {
    let base = if reg.kind == 1 { 10000 } else { 20000 };
    if reg.token > 0 { reg.token + 1 } else { base + reg.refresh_count + 1 }
}

#[no_mangle] pub extern "C" fn cred_reset(){ *STATE.lock().expect("lock") = State::default(); }
#[no_mangle] pub extern "C" fn cred_set_registry_kind(id:i32, kind:i32)->i32{
    let mut s=STATE.lock().expect("lock");
    if !usable_kind(kind) { s.last_error = 4; return 0; }
    if let Some(r)=s.regs.iter_mut().find(|r|r.id==id){ r.kind=kind; s.last_error = 0; return 1; }
    s.regs.push(Reg{id,kind,..Default::default()});
    s.last_error = 0;
    1
}
#[no_mangle] pub extern "C" fn cred_inject_token(id:i32, token:i32, exp:i64)->i32{
    let mut s=STATE.lock().expect("lock");
    if let Some(r)=s.regs.iter_mut().find(|r|r.id==id){ r.token=token; r.expiry=exp; s.last_error=0; 1 } else { s.last_error=2; 0 }
}
#[no_mangle] pub extern "C" fn cred_get(id:i32, now:i64)->i32{
    let mut s=STATE.lock().expect("lock");
    let Some(index)=s.regs.iter().position(|r|r.id==id) else { s.last_error=2; return 0; };
    let (token, error) = {
        let r=&mut s.regs[index];
        if !usable_kind(r.kind) {
            (0, 2)
        } else if r.token != 0 && now < r.expiry {
            (r.token, 0)
        } else if r.error != 0 {
            (0, r.error)
        } else {
            r.token = next_refresh_token(r);
            r.expiry = now + if r.kind == 1 { 45 } else { 60 };
            r.refresh_count += 1;
            (r.token, 0)
        }
    };
    s.last_error = error;
    token
}
#[no_mangle] pub extern "C" fn cred_force_expire(id:i32)->i32{
    let mut s=STATE.lock().expect("lock");
    if let Some(r)=s.regs.iter_mut().find(|r|r.id==id){ r.expiry=0; s.last_error=0; 1 } else { s.last_error=2; 0 }
}
#[no_mangle] pub extern "C" fn cred_set_client_error(id:i32, error:i32)->i32{
    let mut s=STATE.lock().expect("lock");
    if let Some(r)=s.regs.iter_mut().find(|r|r.id==id){ r.error=error; s.last_error=0; 1 } else { s.last_error=2; 0 }
}
#[no_mangle] pub extern "C" fn cred_audit_get(id:i32, now:i64, out:*mut CredAuditView)->i32{
    if out.is_null(){ STATE.lock().expect("lock").last_error=3; return 0; }
    let s=STATE.lock().expect("lock");
    let Some(r)=s.regs.iter().find(|r|r.id==id) else { return 0; };
    unsafe{ *out = CredAuditView{ exists:1, registry_kind:r.kind, cached:(r.token!=0) as i32, expired:(r.token!=0 && now>=r.expiry) as i32, client_error:r.error, token_id:r.token, refresh_count:r.refresh_count, usable:(r.token!=0 && now<r.expiry && r.error==0 && usable_kind(r.kind)) as i32}; }
    1
}
#[no_mangle] pub extern "C" fn cred_count_cached(now:i64)->i32{
    let s=STATE.lock().expect("lock");
    s.regs.iter().filter(|r| r.token!=0 && now<r.expiry && r.error==0 && usable_kind(r.kind)).count() as i32
}
#[no_mangle] pub extern "C" fn cred_last_error()->i32{ STATE.lock().expect("lock").last_error }
