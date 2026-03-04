use std::collections::HashMap;
use std::slice;
use std::str;

static mut REGS: [u16; 8] = [0; 8];
static mut MEM: [u8; 65536] = [0; 65536];
static mut PC: u16 = 0;
static mut SP: u16 = 0xFFFF;
static mut FLAG_Z: i32 = 0;
static mut FLAG_N: i32 = 0;
static mut FLAG_V: i32 = 0;
static mut HALTED: i32 = 0;

fn read16(addr: u16) -> u16 {
    unsafe {
        let lo = MEM[addr as usize] as u16;
        let hi = MEM[(addr.wrapping_add(1)) as usize] as u16;
        (hi << 8) | lo
    }
}

fn write16(addr: u16, value: u16) {
    unsafe {
        MEM[addr as usize] = (value & 0x00FF) as u8;
        MEM[(addr.wrapping_add(1)) as usize] = ((value >> 8) & 0x00FF) as u8;
    }
}

fn set_zn(value: u16) {
    unsafe {
        FLAG_Z = if value == 0 { 1 } else { 0 };
        FLAG_N = if (value & 0x8000) != 0 { 1 } else { 0 };
    }
}

fn set_add_flags(a: u16, b: u16, r: u16) {
    set_zn(r);
    unsafe {
        FLAG_V = if ((a ^ r) & (b ^ r) & 0x8000) != 0 { 1 } else { 0 };
    }
}

fn set_sub_flags(a: u16, b: u16, r: u16) {
    set_zn(r);
    unsafe {
        FLAG_V = if ((a ^ b) & (a ^ r) & 0x8000) != 0 { 1 } else { 0 };
    }
}

fn set_logic_flags(r: u16) {
    set_zn(r);
    unsafe { FLAG_V = 0; }
}

#[no_mangle]
pub extern "C" fn cpu_reset() {
    unsafe {
        REGS = [0; 8];
        MEM = [0; 65536];
        PC = 0;
        SP = 0xFFFF;
        FLAG_Z = 0;
        FLAG_N = 0;
        FLAG_V = 0;
        HALTED = 0;
    }
}

#[no_mangle]
pub extern "C" fn cpu_load_word(addr: i32, word: i32) {
    if !(0..=65534).contains(&addr) { return; }
    write16(addr as u16, word as u16);
}

fn parse_reg(token: &str) -> Option<u16> {
    let t = token.trim();
    if t.len() != 2 { return None; }
    let bytes = t.as_bytes();
    if bytes[0] != b'R' && bytes[0] != b'r' { return None; }
    if !(b'0'..=b'7').contains(&bytes[1]) { return None; }
    Some((bytes[1] - b'0') as u16)
}

fn is_simd_base_reg(reg: u16) -> bool {
    reg == 0 || reg == 4
}

fn parse_num(token: &str) -> Option<i32> {
    let t = token.trim().strip_prefix('#').unwrap_or(token.trim());
    t.parse::<i32>().ok()
}

fn resolve_value(token: &str, labels: &HashMap<String, i32>) -> Option<i32> {
    parse_num(token).or_else(|| labels.get(token.trim()).copied())
}

fn op_value(op: &str) -> Option<u16> {
    Some(match op {
        "NOP" => 0x00, "LOAD" => 0x01, "MOV" => 0x02, "ADD" => 0x03, "SUB" => 0x04,
        "AND" => 0x05, "OR" => 0x06, "XOR" => 0x07, "NOT" => 0x08, "SHL" => 0x09,
        "SHR" => 0x0A, "CMP" => 0x0B, "JMP" => 0x0C, "JZ" => 0x0D, "JNZ" => 0x0E,
        "JN" => 0x0F, "LDR" => 0x10, "STR" => 0x11, "PUSH" => 0x12, "POP" => 0x13,
        "CALL" => 0x14, "RET" => 0x15, "HALT" => 0x16, "VADD" => 0x17, "VSUB" => 0x18,
        "VXOR" => 0x19,
        _ => return None,
    })
}

fn instr_words(op: &str) -> i32 {
    if op == "LOAD" || op == "CALL" { 2 } else { 1 }
}

fn enc_r(op: u16, dst: u16, src: u16, imm5: u16) -> u16 {
    ((op & 0x1F) << 11) | ((dst & 7) << 8) | ((src & 7) << 5) | (imm5 & 0x1F)
}
fn enc_j(op: u16, addr11: u16) -> u16 {
    ((op & 0x1F) << 11) | (addr11 & 0x07FF)
}
fn enc_x(op: u16, dst: u16) -> u16 {
    ((op & 0x1F) << 11) | ((dst & 7) << 8)
}

#[no_mangle]
pub extern "C" fn cpu_assemble(src: *const i8, src_len: i32, out_words: *mut u16, max_words: i32) -> i32 {
    if src.is_null() || out_words.is_null() || src_len <= 0 || max_words <= 0 { return -1; }
    let src_bytes = unsafe { slice::from_raw_parts(src as *const u8, src_len as usize) };
    let src_text = match str::from_utf8(src_bytes) { Ok(s) => s, Err(_) => return -2 };

    let mut labels: HashMap<String, i32> = HashMap::new();
    let mut pc: i32 = 0;

    for line in src_text.lines() {
        let mut s = line.split(';').next().unwrap_or("").trim().to_string();
        while let Some(colon) = s.find(':') {
            let label = s[..colon].trim();
            if label.is_empty() { return -3; }
            if labels.insert(label.to_string(), pc).is_some() {
                return -20;
            }
            s = s[colon + 1..].trim().to_string();
            if s.is_empty() { break; }
        }
        if s.is_empty() { continue; }
        let normalized = s.replace(',', " ");
        let parts: Vec<&str> = normalized.split_whitespace().collect();
        if parts.is_empty() { continue; }
        let op = parts[0].to_uppercase();
        if op_value(&op).is_none() { return -4; }
        pc += instr_words(&op) * 2;
    }

    let mut out: Vec<u16> = Vec::new();
    for line in src_text.lines() {
        let mut s = line.split(';').next().unwrap_or("").trim().to_string();
        while let Some(colon) = s.find(':') {
            s = s[colon + 1..].trim().to_string();
            if s.is_empty() { break; }
        }
        if s.is_empty() { continue; }
        let normalized = s.replace(',', " ");
        let parts: Vec<&str> = normalized.split_whitespace().collect();
        if parts.is_empty() { continue; }
        let op_s = parts[0].to_uppercase();
        let op = match op_value(&op_s) { Some(v) => v, None => return -5 };

        match op {
            0x00 | 0x15 | 0x16 => out.push(enc_r(op, 0, 0, 0)),
            0x12 | 0x13 | 0x08 => {
                let rd = match parts.get(1).and_then(|t| parse_reg(t)) { Some(v) => v, None => return -6 };
                out.push(enc_r(op, rd, 0, 0));
            }
            0x09 | 0x0A => {
                let rd = match parts.get(1).and_then(|t| parse_reg(t)) { Some(v) => v, None => return -7 };
                let imm = match parts.get(2).and_then(|t| resolve_value(t, &labels)) { Some(v) => v, None => return -8 };
                out.push(enc_r(op, rd, 0, imm as u16));
            }
            0x0C | 0x0D | 0x0E | 0x0F => {
                let addr = match parts.get(1).and_then(|t| resolve_value(t, &labels)) { Some(v) => v, None => return -9 };
                if !(0..=0x07FF).contains(&addr) { return -16; }
                out.push(enc_j(op, addr as u16));
            }
            0x01 => {
                let rd = match parts.get(1).and_then(|t| parse_reg(t)) { Some(v) => v, None => return -10 };
                let imm = match parts.get(2).and_then(|t| resolve_value(t, &labels)) { Some(v) => v, None => return -11 };
                if !(-32768..=65535).contains(&imm) { return -17; }
                out.push(enc_x(op, rd));
                out.push(imm as u16);
            }
            0x14 => {
                let addr = match parts.get(1).and_then(|t| resolve_value(t, &labels)) { Some(v) => v, None => return -12 };
                if !(0..=0xFFFF).contains(&addr) { return -18; }
                out.push(enc_x(op, 0));
                out.push(addr as u16);
            }
            _ => {
                let rd = match parts.get(1).and_then(|t| parse_reg(t)) { Some(v) => v, None => return -13 };
                let rs = match parts.get(2).and_then(|t| parse_reg(t)) { Some(v) => v, None => return -14 };
                if (op == 0x17 || op == 0x18 || op == 0x19)
                    && (!is_simd_base_reg(rd) || !is_simd_base_reg(rs))
                {
                    return -19;
                }
                out.push(enc_r(op, rd, rs, 0));
            }
        }
    }

    if out.len() > max_words as usize { return -15; }
    unsafe {
        for (i, w) in out.iter().enumerate() {
            *out_words.add(i) = *w;
        }
    }
    out.len() as i32
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
    if !(0..=65534).contains(&addr) { return 0; }
    read16(addr as u16) as i32
}

#[no_mangle]
pub extern "C" fn cpu_run(max_cycles: i32) -> i32 {
    if max_cycles <= 0 { return 0; }
    let mut cycles = 0;

    while cycles < max_cycles {
        unsafe {
            if HALTED != 0 { break; }
        }

        let instr = read16(unsafe { PC });
        unsafe { PC = PC.wrapping_add(2); }

        let op = (instr >> 11) & 0x1F;
        let dst = ((instr >> 8) & 0x07) as usize;
        let src = ((instr >> 5) & 0x07) as usize;
        let imm5 = instr & 0x1F;
        let jaddr = instr & 0x07FF;
        cycles += 1;

        match op {
            0x00 => {}
            0x01 => {
                let v = read16(unsafe { PC });
                unsafe {
                    PC = PC.wrapping_add(2);
                    REGS[dst] = v;
                }
            }
            0x02 => unsafe { REGS[dst] = REGS[src]; }
            0x03 => unsafe {
                let a = REGS[dst];
                let b = REGS[src];
                let r = a.wrapping_add(b);
                REGS[dst] = r;
                set_add_flags(a, b, r);
            }
            0x04 => unsafe {
                let a = REGS[dst];
                let b = REGS[src];
                let r = a.wrapping_sub(b);
                REGS[dst] = r;
                set_sub_flags(a, b, r);
            }
            0x05 => unsafe { REGS[dst] &= REGS[src]; set_logic_flags(REGS[dst]); }
            0x06 => unsafe { REGS[dst] |= REGS[src]; set_logic_flags(REGS[dst]); }
            0x07 => unsafe { REGS[dst] ^= REGS[src]; set_logic_flags(REGS[dst]); }
            0x08 => unsafe { REGS[dst] = !REGS[dst]; set_logic_flags(REGS[dst]); }
            0x09 => unsafe {
                REGS[dst] = REGS[dst].wrapping_shl((imm5 & 0x0F) as u32);
                set_logic_flags(REGS[dst]);
            }
            0x0A => unsafe {
                REGS[dst] = REGS[dst].wrapping_shr((imm5 & 0x0F) as u32);
                set_logic_flags(REGS[dst]);
            }
            0x0B => unsafe {
                let a = REGS[dst];
                let b = REGS[src];
                let r = a.wrapping_sub(b);
                set_sub_flags(a, b, r);
            }
            0x0C => unsafe { PC = jaddr; }
            0x0D => unsafe { if FLAG_Z != 0 { PC = jaddr; } }
            0x0E => unsafe { if FLAG_Z == 0 { PC = jaddr; } }
            0x0F => unsafe { if FLAG_N != 0 { PC = jaddr; } }
            0x10 => unsafe { REGS[dst] = read16(REGS[src]); }
            0x11 => unsafe { write16(REGS[dst], REGS[src]); }
            0x12 => unsafe {
                SP = SP.wrapping_sub(2);
                write16(SP, REGS[dst]);
            }
            0x13 => unsafe {
                REGS[dst] = read16(SP);
                SP = SP.wrapping_add(2);
            }
            0x14 => {
                let target = read16(unsafe { PC });
                unsafe {
                    PC = PC.wrapping_add(2);
                    SP = SP.wrapping_sub(2);
                    write16(SP, PC);
                    PC = target;
                }
            }
            0x15 => unsafe {
                PC = read16(SP);
                SP = SP.wrapping_add(2);
            }
            0x16 => unsafe { HALTED = 1; }
            0x17 => unsafe {
                if dst > 4 || src > 4 || (dst & 3) != 0 || (src & 3) != 0 {
                    HALTED = 1;
                } else {
                    for i in 0..4 {
                        REGS[dst + i] = REGS[dst + i].wrapping_add(REGS[src + i]);
                    }
                }
            }
            0x18 => unsafe {
                if dst > 4 || src > 4 || (dst & 3) != 0 || (src & 3) != 0 {
                    HALTED = 1;
                } else {
                    for i in 0..4 {
                        REGS[dst + i] = REGS[dst + i].wrapping_sub(REGS[src + i]);
                    }
                }
            }
            0x19 => unsafe {
                if dst > 4 || src > 4 || (dst & 3) != 0 || (src & 3) != 0 {
                    HALTED = 1;
                } else {
                    for i in 0..4 {
                        REGS[dst + i] ^= REGS[src + i];
                    }
                }
            }
            _ => unsafe { HALTED = 1; }
        }
    }

    cycles
}
