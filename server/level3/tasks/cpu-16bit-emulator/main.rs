/*
 * Candidate starter template.
 * Implement the required CPU behavior from the spec.
 */

extern "C" {
    fn ct_reset_state();
    fn ct_load_word(addr: i32, word: i32);
    fn ct_set_reg(idx: i32, value: i32);
    fn ct_get_reg(idx: i32) -> i32;
    fn ct_get_pc() -> i32;
    fn ct_get_sp() -> i32;
    fn ct_get_flag_z() -> i32;
    fn ct_get_flag_n() -> i32;
    fn ct_get_flag_v() -> i32;
    fn ct_mem_read16(addr: i32) -> i32;
}

#[no_mangle]
pub extern "C" fn cpu_reset() {
    unsafe { ct_reset_state(); }
}

#[no_mangle]
pub extern "C" fn cpu_load_word(addr: i32, word: i32) {
    unsafe { ct_load_word(addr, word); }
}

#[no_mangle]
pub extern "C" fn cpu_assemble(
    src: *const i8,
    src_len: i32,
    out_words: *mut u16,
    max_words: i32,
) -> i32 {
    // TODO: implement two-pass assembler; return words written or negative on error.
    let _ = (src, src_len, out_words, max_words);
    -1
}

#[no_mangle]
pub extern "C" fn cpu_set_reg(idx: i32, value: i32) {
    unsafe { ct_set_reg(idx, value); }
}

#[no_mangle]
pub extern "C" fn cpu_get_reg(idx: i32) -> i32 {
    unsafe { ct_get_reg(idx) }
}

#[no_mangle]
pub extern "C" fn cpu_get_pc() -> i32 {
    unsafe { ct_get_pc() }
}

#[no_mangle]
pub extern "C" fn cpu_get_sp() -> i32 {
    unsafe { ct_get_sp() }
}

#[no_mangle]
pub extern "C" fn cpu_get_flag_z() -> i32 {
    unsafe { ct_get_flag_z() }
}

#[no_mangle]
pub extern "C" fn cpu_get_flag_n() -> i32 {
    unsafe { ct_get_flag_n() }
}

#[no_mangle]
pub extern "C" fn cpu_get_flag_v() -> i32 {
    unsafe { ct_get_flag_v() }
}

#[no_mangle]
pub extern "C" fn cpu_mem_read16(addr: i32) -> i32 {
    unsafe { ct_mem_read16(addr) }
}

#[no_mangle]
pub extern "C" fn cpu_run(max_cycles: i32) -> i32 {
    // TODO: implement full emulator.
    let _ = max_cycles;
    0
}
