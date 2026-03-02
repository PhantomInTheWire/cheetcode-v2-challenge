static mut REGS: [u16; 8] = [0; 8];
static mut MEM: [u16; 32768] = [0; 32768];
static mut PC: u16 = 0;
static mut SP: u16 = 0xFFFF;
static mut FLAG_Z: i32 = 0;
static mut FLAG_N: i32 = 0;
static mut FLAG_V: i32 = 0;

#[no_mangle]
pub extern "C" fn cpu_reset() {
    unsafe {
        REGS = [0; 8];
        MEM = [0; 32768];
        PC = 0;
        SP = 0xFFFF;
        FLAG_Z = 0;
        FLAG_N = 0;
        FLAG_V = 0;
    }
}

#[no_mangle]
pub extern "C" fn cpu_load_word(addr: i32, word: i32) {
    if addr < 0 { return; }
    let a = (addr as u16) as usize;
    let w = word as u16;
    unsafe {
        let bytes = core::slice::from_raw_parts_mut(MEM.as_mut_ptr() as *mut u8, 65536);
        bytes[a] = (w & 0x00FF) as u8;
        bytes[((a as u16).wrapping_add(1)) as usize] = ((w >> 8) & 0x00FF) as u8;
    }
}

#[no_mangle]
pub extern "C" fn cpu_assemble(src: *const i8, src_len: i32, out_words: *mut u16, max_words: i32) -> i32 {
    // TODO: implement two-pass assembler; return words written or negative on error.
    let _ = (src, src_len, out_words, max_words);
    -1
}

#[no_mangle]
pub extern "C" fn cpu_set_reg(idx: i32, value: i32) {
    if !(0..=7).contains(&idx) { return; }
    unsafe { REGS[idx as usize] = value as u16; }
}
#[no_mangle]
pub extern "C" fn cpu_get_reg(idx: i32) -> i32 {
    if !(0..=7).contains(&idx) { return 0; }
    unsafe { REGS[idx as usize] as i32 }
}
#[no_mangle]
pub extern "C" fn cpu_get_pc() -> i32 { unsafe { PC as i32 } }
#[no_mangle]
pub extern "C" fn cpu_get_sp() -> i32 { unsafe { SP as i32 } }
#[no_mangle]
pub extern "C" fn cpu_get_flag_z() -> i32 { unsafe { FLAG_Z } }
#[no_mangle]
pub extern "C" fn cpu_get_flag_n() -> i32 { unsafe { FLAG_N } }
#[no_mangle]
pub extern "C" fn cpu_get_flag_v() -> i32 { unsafe { FLAG_V } }
#[no_mangle]
pub extern "C" fn cpu_mem_read16(addr: i32) -> i32 {
    if addr < 0 { return 0; }
    let a = (addr as u16) as usize;
    unsafe {
        let bytes = core::slice::from_raw_parts(MEM.as_ptr() as *const u8, 65536);
        let lo = bytes[a] as u16;
        let hi = bytes[((a as u16).wrapping_add(1)) as usize] as u16;
        ((hi << 8) | lo) as i32
    }
}

#[no_mangle]
pub extern "C" fn cpu_run(max_cycles: i32) -> i32 {
    // TODO: implement full emulator.
    let _ = max_cycles;
    0
}
