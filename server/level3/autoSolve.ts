export function getLevel3AutoSolveCode(language: string): string {
  if (language === "C") {
    return `
static unsigned short regs[8];
static unsigned short pc = 0;
static unsigned short sp = 0xFFFF;
static unsigned char mem[65536];
static int flag_z = 0;
static int flag_n = 0;
static int flag_v = 0;
static int halted = 0;

static unsigned short read16(unsigned short addr) {
  unsigned short lo = (unsigned short)mem[addr];
  unsigned short hi = (unsigned short)mem[(unsigned short)(addr + 1)];
  return (unsigned short)((hi << 8) | lo);
}

static void write16(unsigned short addr, unsigned short value) {
  mem[addr] = (unsigned char)(value & 0xFF);
  mem[(unsigned short)(addr + 1)] = (unsigned char)((value >> 8) & 0xFF);
}

static void set_zn(unsigned short value) {
  flag_z = (value == 0) ? 1 : 0;
  flag_n = (value & 0x8000) ? 1 : 0;
}

static void set_add_flags(unsigned short a, unsigned short b, unsigned short r) {
  set_zn(r);
  flag_v = (((a ^ r) & (b ^ r) & 0x8000) != 0) ? 1 : 0;
}

static void set_sub_flags(unsigned short a, unsigned short b, unsigned short r) {
  set_zn(r);
  flag_v = (((a ^ b) & (a ^ r) & 0x8000) != 0) ? 1 : 0;
}

static void set_logic_flags(unsigned short r) {
  set_zn(r);
  flag_v = 0;
}

__attribute__((visibility("default"))) void cpu_reset(void) {
  for (int i = 0; i < 8; i++) regs[i] = 0;
  for (int i = 0; i < 65536; i++) mem[i] = 0;
  pc = 0;
  sp = 0xFFFF;
  flag_z = 0;
  flag_n = 0;
  flag_v = 0;
  halted = 0;
}

__attribute__((visibility("default"))) void cpu_load_word(int addr, int word) {
  if (addr < 0) return;
  write16((unsigned short)addr, (unsigned short)word);
}

__attribute__((visibility("default"))) void cpu_set_reg(int idx, int value) {
  if (idx < 0 || idx > 7) return;
  regs[idx] = (unsigned short)value;
}

__attribute__((visibility("default"))) int cpu_get_reg(int idx) {
  if (idx < 0 || idx > 7) return 0;
  return regs[idx];
}

__attribute__((visibility("default"))) int cpu_get_pc(void) { return pc; }
__attribute__((visibility("default"))) int cpu_get_sp(void) { return sp; }
__attribute__((visibility("default"))) int cpu_get_flag_z(void) { return flag_z; }
__attribute__((visibility("default"))) int cpu_get_flag_n(void) { return flag_n; }
__attribute__((visibility("default"))) int cpu_get_flag_v(void) { return flag_v; }

__attribute__((visibility("default"))) int cpu_mem_read16(int addr) {
  if (addr < 0) return 0;
  return read16((unsigned short)addr);
}

__attribute__((visibility("default"))) int cpu_run(int max_cycles) {
  int cycles = 0;
  if (max_cycles <= 0) return 0;

  while (cycles < max_cycles && !halted) {
    unsigned short instr = read16(pc);
    pc = (unsigned short)(pc + 2);

    unsigned short op = (unsigned short)((instr >> 11) & 0x1F);
    unsigned short dst = (unsigned short)((instr >> 8) & 0x07);
    unsigned short src = (unsigned short)((instr >> 5) & 0x07);
    unsigned short imm5 = (unsigned short)(instr & 0x1F);
    unsigned short jaddr = (unsigned short)(instr & 0x7FF);
    cycles++;

    switch (op) {
      case 0x00: // NOP
        break;
      case 0x01: // LOAD
        regs[dst] = read16(pc);
        pc = (unsigned short)(pc + 2);
        break;
      case 0x02: // MOV
        regs[dst] = regs[src];
        break;
      case 0x03: { // ADD
        unsigned short a = regs[dst];
        unsigned short b = regs[src];
        unsigned short r = (unsigned short)(a + b);
        regs[dst] = r;
        set_add_flags(a, b, r);
      } break;
      case 0x04: { // SUB
        unsigned short a = regs[dst];
        unsigned short b = regs[src];
        unsigned short r = (unsigned short)(a - b);
        regs[dst] = r;
        set_sub_flags(a, b, r);
      } break;
      case 0x05: // AND
        regs[dst] = (unsigned short)(regs[dst] & regs[src]);
        set_logic_flags(regs[dst]);
        break;
      case 0x06: // OR
        regs[dst] = (unsigned short)(regs[dst] | regs[src]);
        set_logic_flags(regs[dst]);
        break;
      case 0x07: // XOR
        regs[dst] = (unsigned short)(regs[dst] ^ regs[src]);
        set_logic_flags(regs[dst]);
        break;
      case 0x08: // NOT
        regs[dst] = (unsigned short)(~regs[dst]);
        set_logic_flags(regs[dst]);
        break;
      case 0x09: // SHL
        regs[dst] = (unsigned short)(regs[dst] << (imm5 & 0x0F));
        set_logic_flags(regs[dst]);
        break;
      case 0x0A: // SHR
        regs[dst] = (unsigned short)(regs[dst] >> (imm5 & 0x0F));
        set_logic_flags(regs[dst]);
        break;
      case 0x0B: { // CMP
        unsigned short a = regs[dst];
        unsigned short b = regs[src];
        unsigned short r = (unsigned short)(a - b);
        set_sub_flags(a, b, r);
      } break;
      case 0x0C: // JMP
        pc = jaddr;
        break;
      case 0x0D: // JZ
        if (flag_z) pc = jaddr;
        break;
      case 0x0E: // JNZ
        if (!flag_z) pc = jaddr;
        break;
      case 0x0F: // JN
        if (flag_n) pc = jaddr;
        break;
      case 0x10: // LDR
        regs[dst] = read16(regs[src]);
        break;
      case 0x11: // STR
        write16(regs[dst], regs[src]);
        break;
      case 0x12: // PUSH
        sp = (unsigned short)(sp - 2);
        write16(sp, regs[dst]);
        break;
      case 0x13: // POP
        regs[dst] = read16(sp);
        sp = (unsigned short)(sp + 2);
        break;
      case 0x14: { // CALL
        unsigned short target = read16(pc);
        pc = (unsigned short)(pc + 2);
        sp = (unsigned short)(sp - 2);
        write16(sp, pc);
        pc = target;
      } break;
      case 0x15: // RET
        pc = read16(sp);
        sp = (unsigned short)(sp + 2);
        break;
      case 0x16: // HALT
        halted = 1;
        break;
      default:
        halted = 1;
        break;
    }
  }

  return cycles;
}
`.trim();
  }

  if (language === "C++") {
    return `
extern "C" {
${getLevel3AutoSolveCode("C")}
}
`.trim();
  }

  return `
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
    if addr < 0 { return; }
    write16(addr as u16, word as u16);
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
            _ => unsafe { HALTED = 1; }
        }
    }

    cycles
}
`.trim();
}
