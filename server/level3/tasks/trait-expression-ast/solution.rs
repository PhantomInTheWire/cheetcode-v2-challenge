use std::ffi::CStr;
use std::os::raw::c_char;
use std::sync::{LazyLock, Mutex};

#[repr(C)]
pub struct ExprAuditView { pub exists:i32, pub kind:i32, pub string_evaluable:i32, pub match_evaluable:i32, pub constant_expr:i32, pub namespace_error:i32, pub matched:i32, pub output_string_id:i32 }
#[derive(Clone,Default)] struct Var{ id:i32, ns:i32, val_id:i32 }
#[derive(Clone,Default)] struct Str{ id:i32, v:String }
#[derive(Clone,Default)] struct Expr{ id:i32, kind:i32, a:i32, b:i32, c:i32 }
#[derive(Default)] struct State{ vars:Vec<Var>, strs:Vec<Str>, exprs:Vec<Expr>, last_error:i32, next_id:i32 }
static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| Mutex::new(State{next_id:1000,..Default::default()}));

fn strf(s:&State,id:i32)->Option<String>{ s.strs.iter().find(|x|x.id==id).map(|x|x.v.clone()) }
fn intern(state:&mut State, value:&str)->i32{ if let Some(s)=state.strs.iter().find(|x|x.v==value){ return s.id; } let id=state.next_id; state.next_id+=1; state.strs.push(Str{id,v:value.to_string()}); id }
fn eval_string_id(state:&mut State, expr_id:i32, depth:i32)->i32{
    let e = match state.exprs.iter().find(|x|x.id==expr_id).cloned() { Some(v) => v, None => { state.last_error = 2; return 0; } };
    if depth > 32 { state.last_error = 6; return 0; }
    match e.kind {
        1 => e.a,
        2 => {
            let Some(v) = state.vars.iter().find(|x|x.id==e.a).cloned() else { state.last_error = 2; return 0; };
            if !(1..=3).contains(&v.ns) { state.last_error = 4; return 0; }
            v.val_id
        }
        3 => {
            let child_id = eval_string_id(state, e.a, depth + 1);
            let Some(mut s) = strf(state, child_id) else { return 0; };
            if let Some(idx) = s.find('@') { s.truncate(idx); }
            intern(state, &s)
        }
        4 => {
            let child_id = eval_string_id(state, e.a, depth + 1);
            let Some(s) = strf(state, child_id) else { return 0; };
            let Some(pat) = strf(state, e.b) else { state.last_error = 2; return 0; };
            let Some(rep) = strf(state, e.c) else { state.last_error = 2; return 0; };
            intern(state, &s.replacen(&pat, &rep, 1))
        }
        _ => { state.last_error = 5; 0 }
    }
}
fn eval_match(state:&mut State, expr_id:i32, matcher_sid:i32)->i32{
    let Some(e) = state.exprs.iter().find(|x|x.id==expr_id).cloned() else { state.last_error = 2; return 0; };
    if e.kind != 5 { state.last_error = 5; return 0; }
    let sid = if e.a != 0 { eval_string_id(state, e.a, 0) } else { matcher_sid };
    let Some(val) = strf(state, sid) else { state.last_error = 2; return 0; };
    let Some(pat) = strf(state, e.b) else { state.last_error = 2; return 0; };
    state.last_error = 0;
    (val.contains(&pat) ^ (e.c != 0)) as i32
}

#[no_mangle] pub extern "C" fn expr_reset(){ *STATE.lock().expect("lock") = State{next_id:1000,..Default::default()}; }
#[no_mangle] pub extern "C" fn expr_register_string(id:i32, value:*const c_char)->i32{
    let mut s=STATE.lock().expect("lock");
    if s.strs.iter().any(|x|x.id==id){ s.last_error=1; return 0; }
    let text=unsafe{ if value.is_null() { "".to_string() } else { CStr::from_ptr(value).to_string_lossy().into_owned() } };
    s.strs.push(Str{id,v:text});
    s.last_error = 0;
    1
}
#[no_mangle] pub extern "C" fn expr_register_var(id:i32, ns:i32, sid:i32)->i32{
    let mut s=STATE.lock().expect("lock");
    if s.vars.iter().any(|x|x.id==id){ s.last_error=1; return 0; }
    s.vars.push(Var{id,ns,val_id:sid});
    s.last_error = 0;
    1
}
fn add_expr(state:&mut State,id:i32,kind:i32,a:i32,b:i32,c:i32)->i32{
    if state.exprs.iter().any(|x|x.id==id){ state.last_error=1; return 0; }
    state.exprs.push(Expr{id,kind,a,b,c});
    state.last_error = 0;
    1
}
#[no_mangle] pub extern "C" fn expr_compile_literal(id:i32,sid:i32)->i32{ add_expr(&mut STATE.lock().expect("lock"),id,1,sid,0,0) }
#[no_mangle] pub extern "C" fn expr_compile_var(id:i32,vid:i32)->i32{ add_expr(&mut STATE.lock().expect("lock"),id,2,vid,0,0) }
#[no_mangle] pub extern "C" fn expr_compile_email_local(id:i32,child:i32)->i32{ add_expr(&mut STATE.lock().expect("lock"),id,3,child,0,0) }
#[no_mangle] pub extern "C" fn expr_compile_regex_replace(id:i32,input:i32,pat:i32,rep:i32)->i32{ add_expr(&mut STATE.lock().expect("lock"),id,4,input,pat,rep) }
#[no_mangle] pub extern "C" fn expr_compile_regex_match(id:i32,input:i32,pat:i32,negate:i32)->i32{ add_expr(&mut STATE.lock().expect("lock"),id,5,input,pat,negate) }
#[no_mangle] pub extern "C" fn expr_evaluate_string(expr_id:i32,out:*mut i32)->i32{
    if out.is_null(){ STATE.lock().expect("lock").last_error=3; return 0; }
    let mut s=STATE.lock().expect("lock");
    let Some(expr)=s.exprs.iter().find(|x|x.id==expr_id).cloned() else { s.last_error = 2; return 0; };
    if expr.kind == 5 { s.last_error = 5; return 0; }
    let sid=eval_string_id(&mut s,expr_id,0);
    if sid==0 { return 0; }
    unsafe{ *out=sid; }
    s.last_error = 0;
    1
}
#[no_mangle] pub extern "C" fn expr_evaluate_match(expr_id:i32,matcher_sid:i32)->i32{
    let mut s=STATE.lock().expect("lock");
    eval_match(&mut s, expr_id, matcher_sid)
}
#[no_mangle] pub extern "C" fn expr_audit_get(expr_id:i32,matcher_sid:i32,out:*mut ExprAuditView)->i32{
    if out.is_null(){ STATE.lock().expect("lock").last_error=3; return 0; }
    let mut s=STATE.lock().expect("lock");
    let Some(e)=s.exprs.iter().find(|x|x.id==expr_id).cloned() else { return 0; };
    let ns_err=if e.kind==2 { s.vars.iter().find(|x|x.id==e.a).map(|v| !(1..=3).contains(&v.ns) ).unwrap_or(false) } else { false };
    let output=if e.kind!=5 { eval_string_id(&mut s,expr_id,0) } else { 0 };
    let matched=if e.kind==5 { eval_match(&mut s, expr_id, matcher_sid) } else { 0 };
    unsafe{ *out=ExprAuditView{ exists:1, kind:e.kind, string_evaluable:(e.kind!=5) as i32, match_evaluable:(e.kind==5) as i32, constant_expr:(e.kind==1) as i32, namespace_error:ns_err as i32, matched, output_string_id:output }; }
    1
}
#[no_mangle] pub extern "C" fn expr_last_error()->i32{ STATE.lock().expect("lock").last_error }
