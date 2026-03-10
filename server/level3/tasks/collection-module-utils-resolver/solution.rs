use std::sync::{LazyLock, Mutex};

#[repr(C)]
pub struct ResolverAuditView { pub exists:i32, pub resolved:i32, pub redirected:i32, pub synthesized_init:i32, pub deprecated_redirect:i32, pub tombstoned:i32, pub ambiguous_import:i32, pub included_in_payload:i32 }
#[derive(Clone,Default)] struct Module{ id:i32,parent:i32,is_package:i32,has_init:i32 }
#[derive(Clone,Default)] struct Import{ owner:i32,target:i32,ambiguous:i32 }
#[derive(Clone,Default)] struct Redirect{ from:i32,to:i32,deprecated:i32,tombstoned:i32 }
#[derive(Clone,Default)] struct PayloadState{ root_id:i32, direct_ids:Vec<i32>, synth_ids:Vec<i32> }
#[derive(Default)] struct State{ mods:Vec<Module>, imps:Vec<Import>, reds:Vec<Redirect>, payloads:Vec<PayloadState>, last_error:i32 }
static STATE: LazyLock<Mutex<State>> = LazyLock::new(|| Mutex::new(State::default()));

fn ensure_payload_index(s: &mut State, root_id: i32) -> usize {
    if let Some(index) = s.payloads.iter().position(|p| p.root_id == root_id) { return index; }
    s.payloads.push(PayloadState { root_id, direct_ids: Vec::new(), synth_ids: Vec::new() });
    s.payloads.len() - 1
}
fn resolve_target(s: &State, start: i32) -> (i32, i32, i32, i32) {
    let mut target = start;
    let mut redirected = 0;
    let mut deprecated = 0;
    let mut tombstoned = 0;
    for _ in 0..256 {
        let Some(red) = s.reds.iter().find(|r| r.from == target) else { return (target, redirected, deprecated, tombstoned); };
        redirected = 1;
        if red.deprecated != 0 { deprecated = 1; }
        if red.tombstoned != 0 { tombstoned = 1; return (-1, redirected, deprecated, tombstoned); }
        target = red.to;
    }
    (-1, redirected, deprecated, 1)
}
fn add_unique(list: &mut Vec<i32>, id: i32) { if !list.contains(&id) { list.push(id); } }

#[no_mangle] pub extern "C" fn resolver_reset(){ *STATE.lock().expect("lock") = State::default(); }
#[no_mangle] pub extern "C" fn resolver_add_module(module_id:i32,parent_module_id:i32,is_package:i32,has_init:i32)->i32{ let mut s=STATE.lock().expect("lock"); if s.mods.iter().any(|m|m.id==module_id){s.last_error=1; return 0;} s.mods.push(Module{id:module_id,parent:parent_module_id,is_package,has_init}); s.last_error=0; 1 }
#[no_mangle] pub extern "C" fn resolver_add_import(owner_module_id:i32,target_module_id:i32,ambiguous:i32)->i32{ let mut s=STATE.lock().expect("lock"); if !s.mods.iter().any(|m|m.id==owner_module_id){s.last_error=2; return 0;} s.imps.push(Import{owner:owner_module_id,target:target_module_id,ambiguous}); s.last_error=0; 1 }
#[no_mangle] pub extern "C" fn resolver_add_redirect(from_module_id:i32,to_module_id:i32,deprecated:i32,tombstoned:i32)->i32{ let mut s=STATE.lock().expect("lock"); if s.reds.iter().any(|r|r.from==from_module_id){s.last_error=1; return 0;} s.reds.push(Redirect{from:from_module_id,to:to_module_id,deprecated,tombstoned}); s.last_error=0; 1 }
#[no_mangle] pub extern "C" fn resolver_build_payload(root_module_id:i32)->i32{
    let mut s=STATE.lock().expect("lock");
    if !s.mods.iter().any(|m|m.id==root_module_id){ s.last_error=2; return 0; }
    let payload_index = ensure_payload_index(&mut s, root_module_id);
    s.payloads[payload_index].direct_ids.clear();
    s.payloads[payload_index].synth_ids.clear();
    let mut queue=vec![root_module_id];
    let mut seen: Vec<i32> = Vec::new();
    while let Some(cur)=queue.pop() {
        if seen.contains(&cur) { continue; }
        seen.push(cur);
        add_unique(&mut s.payloads[payload_index].direct_ids, cur);
        let mut parent = s.mods.iter().find(|m| m.id == cur).map(|m| m.parent).unwrap_or(-1);
        while parent >= 0 {
            let Some(pm) = s.mods.iter().find(|m| m.id == parent).cloned() else { break; };
            if pm.is_package != 0 && pm.has_init == 0 { add_unique(&mut s.payloads[payload_index].synth_ids, pm.id); }
            parent = pm.parent;
        }
        let owned_imports: Vec<Import> = s.imps.iter().filter(|i| i.owner == cur).cloned().collect();
        for imp in owned_imports {
            let (target, _, _, tomb) = resolve_target(&s, imp.target);
            if tomb != 0 || target < 0 { continue; }
            if s.mods.iter().any(|m| m.id == target) { queue.push(target); }
        }
    }
    s.last_error=0;
    1
}
#[no_mangle] pub extern "C" fn resolver_payload_contains(root_module_id:i32,module_id:i32)->i32{
    let s=STATE.lock().expect("lock");
    let Some(payload)=s.payloads.iter().find(|p|p.root_id==root_module_id) else { return 0; };
    (payload.direct_ids.contains(&module_id) || payload.synth_ids.contains(&module_id)) as i32
}
#[no_mangle] pub extern "C" fn resolver_audit_get(root_module_id:i32,module_id:i32,out_view:*mut ResolverAuditView)->i32{
    if out_view.is_null(){ STATE.lock().expect("lock").last_error=3; return 0; }
    let s=STATE.lock().expect("lock");
    if !s.mods.iter().any(|m|m.id==module_id) && !s.reds.iter().any(|r|r.from==module_id) { return 0; }
    let payload = s.payloads.iter().find(|p| p.root_id == root_module_id);
    let (target, redirected, deprecated, tombstoned) = resolve_target(&s, module_id);
    let ambiguous = s.imps.iter().any(|i| i.target == module_id && i.ambiguous != 0) as i32;
    let synthesized = payload.map(|p| p.synth_ids.contains(&module_id) as i32).unwrap_or(0);
    let included = payload.map(|p| (p.direct_ids.contains(&module_id) || p.synth_ids.contains(&module_id)) as i32).unwrap_or(0);
    unsafe { *out_view = ResolverAuditView { exists:1, resolved:(target >= 0) as i32, redirected, synthesized_init:synthesized, deprecated_redirect:deprecated, tombstoned, ambiguous_import:ambiguous, included_in_payload:included }; }
    1
}
#[no_mangle] pub extern "C" fn resolver_count_payload_modules(root_module_id:i32)->i32{
    let s=STATE.lock().expect("lock");
    let Some(payload)=s.payloads.iter().find(|p|p.root_id==root_module_id) else { return 0; };
    (payload.direct_ids.len() + payload.synth_ids.len()) as i32
}
#[no_mangle] pub extern "C" fn resolver_last_error()->i32{ STATE.lock().expect("lock").last_error }
