# LLVM Configuration

## Project: LLVM

Source: `/Users/ghost/llvm-project`
Output: `data/llvm-questions.json`
Extensions: `*.cpp, *.h, *.td, *.inc`
ID Prefix: `llvm_`

### Architecture Layers

LLVM is a modular compiler infrastructure with a well-defined pipeline. Questions describe the top (source-level behavior); answers live at the bottom (internal enums, error codes, constants).

```
Source code (C/C++/Rust/Fortran/etc.)
  -> Clang frontend (lexing, parsing, semantic analysis, AST construction)
    -> Clang CodeGen (AST -> LLVM IR emission)
      -> LLVM IR optimization passes (Analysis/, Transforms/)
        -> Instruction selection (SelectionDAG / GlobalISel -> MachineInstr)
          -> Register allocation & machine-level optimization (CodeGen/)
            -> MC layer (MachineInstr -> MCInst -> binary encoding)
              -> Object emission & linking (Object/, BinaryFormat/, lld/)
                -> THE ANSWER: enum/error/constant
```

### Synonym Table

| Internal Term                  | Use Instead                                          |
| ------------------------------ | ---------------------------------------------------- |
| LLVM IR                        | intermediate program blueprint                       |
| SSA (Static Single Assignment) | single-assignment variable form                      |
| basic block                    | sequential instruction region                        |
| phi node                       | branch-convergence value selector                    |
| dominator tree                 | control-flow ancestry graph                          |
| register allocator             | physical storage assigner                            |
| instruction selection (ISel)   | pattern-to-machine-operation mapper                  |
| SelectionDAG                   | operation dependency graph                           |
| GlobalISel                     | generic instruction lowering framework               |
| pass (optimization pass)       | transformation stage                                 |
| intrinsic                      | compiler-recognized built-in operation               |
| ABI / calling convention       | inter-routine communication contract                 |
| linkage                        | cross-module visibility rule                         |
| metadata                       | auxiliary annotation                                 |
| MachineInstr                   | target-specific operation record                     |
| MCInst                         | final machine encoding record                        |
| TableGen (.td)                 | declarative target descriptor language               |
| ELF                            | binary container format (Unix)                       |
| MachO                          | binary container format (Apple)                      |
| COFF                           | binary container format (Windows)                    |
| relocation                     | address fixup record                                 |
| DWARF                          | debug annotation format                              |
| CodeView                       | debug annotation format (Windows)                    |
| sanitizer (ASan/TSan/MSan)     | runtime correctness monitor                          |
| UBSan                          | undefined behavior runtime detector                  |
| inlining                       | callee body absorption                               |
| loop vectorization             | iteration-parallel widening                          |
| SLP vectorization              | adjacent-value parallel packing                      |
| GVN (Global Value Numbering)   | redundant computation eliminator                     |
| SROA                           | aggregate-to-scalar decomposer                       |
| SCCP                           | constant propagation solver                          |
| LICM                           | invariant-code elevation from cycles                 |
| dead store elimination         | unused write removal                                 |
| alias analysis                 | memory reference overlap oracle                      |
| ScalarEvolution (SCEV)         | induction variable progression modeler               |
| MemorySSA                      | memory access ordering graph                         |
| LTO (Link-Time Optimization)   | whole-program deferred optimization                  |
| ThinLTO                        | summary-guided cross-module optimization             |
| Clang Sema                     | source-language rule enforcer                        |
| Clang AST                      | parsed program structure tree                        |
| Clang Driver                   | compilation orchestration and tool invocation         |
| Clang diagnostic               | compiler-emitted developer message                   |
| lld                            | machine code linker                                  |
| JIT (ORC/MCJIT)               | on-demand code materializer                          |
| live range / live interval     | value temporal occupancy span                        |
| spill                          | register-to-memory eviction                          |
| stack frame                    | per-invocation local storage region                  |
| constant folding               | compile-time expression resolution                   |
| branch probability             | execution path likelihood estimate                   |
| profile-guided optimization    | observed-execution-weighted transformation           |
| poison value                   | deferred-undefined sentinel                          |
| undef                          | indeterminate placeholder value                      |
| GEP (GetElementPtr)            | structured memory offset calculator                  |
| landing pad                    | exception arrival handler                            |
| personality function           | unwinding strategy selector                          |
| comdat                         | duplicate-elimination grouping token                 |
| section                        | binary placement region                              |
| symbol                         | named entity reference in output                     |
| Target Triple                  | platform architecture descriptor string              |

### Hotspot Areas

#### LLVM IR & Type System

- `llvm/include/llvm/IR/Instruction.def` -- IR instruction opcode definitions
- `llvm/include/llvm/IR/Intrinsics.td` -- intrinsic function ID definitions
- `llvm/include/llvm/IR/Attributes.td` -- function/parameter attribute kinds
- `llvm/include/llvm/IR/Value.def` -- value type class hierarchy IDs
- `llvm/include/llvm/IR/Metadata.def` -- metadata node kind definitions
- `llvm/include/llvm/IR/FixedMetadataKinds.def` -- fixed metadata kind IDs
- `llvm/include/llvm/IR/CallingConv.h` -- calling convention enum values
- `llvm/include/llvm/IR/DiagnosticInfo.h` -- IR-level diagnostic severity/kind enums
- `llvm/lib/IR/` -- IR construction, verification, constant folding

#### Code Generation (SelectionDAG & MachineInstr)

- `llvm/include/llvm/CodeGen/ISDOpcodes.h` -- SelectionDAG node opcode enum
- `llvm/include/llvm/CodeGen/TargetOpcodes.h` -- generic target-independent MI opcodes
- `llvm/include/llvm/CodeGen/ValueTypes.h` -- machine value type (MVT) enum
- `llvm/include/llvm/CodeGen/MachineOperand.h` -- machine operand type enum
- `llvm/include/llvm/CodeGen/SelectionDAGNodes.h` -- DAG node flags and types
- `llvm/include/llvm/CodeGen/RegAllocCommon.h` -- register allocation filter enums
- `llvm/lib/CodeGen/` -- register allocation, scheduling, frame lowering, peephole
- `llvm/lib/CodeGen/SelectionDAG/` -- DAG-based instruction selection

#### GlobalISel (Generic Instruction Selection)

- `llvm/include/llvm/CodeGen/GlobalISel/` -- generic MIR-level instruction selection
- `llvm/include/llvm/Target/GenericOpcodes.td` -- generic opcode definitions for GlobalISel
- `llvm/include/llvm/CodeGen/GlobalISel/LegalizerInfo.h` -- legalization action enums

#### Machine Code (MC) Layer

- `llvm/include/llvm/MC/MCDirectives.h` -- assembler directive enum
- `llvm/include/llvm/MC/MCFixup.h` -- fixup kind enum
- `llvm/include/llvm/MC/MCExpr.h` -- MC expression kind enum
- `llvm/include/llvm/MC/MCSection.h` -- section variant kind
- `llvm/include/llvm/MC/SectionKind.h` -- section classification enum
- `llvm/lib/MC/` -- assembler, object writers, streamers

#### Binary Formats (ELF, MachO, COFF, Wasm)

- `llvm/include/llvm/BinaryFormat/ELF.h` -- ELF types, section types, segment types, flags
- `llvm/include/llvm/BinaryFormat/ELFRelocs/` -- per-architecture ELF relocation types
- `llvm/include/llvm/BinaryFormat/MachO.h` -- Mach-O load commands, section types
- `llvm/include/llvm/BinaryFormat/COFF.h` -- COFF section flags, machine types
- `llvm/include/llvm/BinaryFormat/Dwarf.h` -- DWARF tag, attribute, form enums
- `llvm/include/llvm/BinaryFormat/Wasm.h` -- WebAssembly section types
- `llvm/include/llvm/BinaryFormat/XCOFF.h` -- XCOFF storage classes and types

#### Object File Handling

- `llvm/include/llvm/Object/Error.h` -- object file error codes
- `llvm/include/llvm/Object/ELF.h` -- ELF object file reader
- `llvm/include/llvm/Object/MachO.h` -- MachO object file reader
- `llvm/include/llvm/Object/COFF.h` -- COFF object file reader
- `llvm/lib/Object/` -- binary parsing, relocation resolution

#### Debug Info (DWARF & CodeView)

- `llvm/include/llvm/BinaryFormat/Dwarf.def` -- DWARF attribute/tag enumerations
- `llvm/include/llvm/DebugInfo/DWARF/` -- DWARF parsing and interpretation
- `llvm/include/llvm/DebugInfo/CodeView/CodeView.h` -- CodeView type/symbol enums
- `llvm/include/llvm/DebugInfo/CodeView/CodeViewSymbols.def` -- CodeView symbol record kinds
- `llvm/include/llvm/DebugInfo/CodeView/CodeViewTypes.def` -- CodeView type record kinds
- `llvm/include/llvm/IR/DebugInfoFlags.def` -- debug info flag enums
- `llvm/include/llvm/IR/DebugInfoMetadata.h` -- DI metadata node types

#### Support & Error Handling

- `llvm/include/llvm/Support/Error.h` -- Error/Expected error handling framework
- `llvm/include/llvm/Support/Errc.h` -- LLVM-specific error condition enum
- `llvm/include/llvm/Support/BinaryStreamError.h` -- binary stream error codes
- `llvm/include/llvm/Support/CodeGen.h` -- codegen optimization level, relocation model enums
- `llvm/include/llvm/Support/AtomicOrdering.h` -- memory ordering enum
- `llvm/include/llvm/Support/ModRef.h` -- memory mod/ref result enums

#### Optimization Passes (Scalar)

- `llvm/lib/Transforms/Scalar/` -- SROA, GVN, LICM, loop unrolling, jump threading, DSE, SCCP
- `llvm/lib/Transforms/Vectorize/` -- loop vectorizer, SLP vectorizer, VPlan
- `llvm/lib/Transforms/IPO/` -- inlining, dead argument elimination, global optimization
- `llvm/lib/Transforms/InstCombine/` -- instruction combining / peephole
- `llvm/lib/Transforms/Utils/` -- pass utility functions, simplify CFG
- `llvm/lib/Transforms/Instrumentation/` -- sanitizer, profiling, coverage instrumentation

#### Analysis Framework

- `llvm/include/llvm/Analysis/AliasAnalysis.h` -- alias analysis result enums (AliasResult)
- `llvm/include/llvm/Analysis/MemoryLocation.h` -- memory location size classification
- `llvm/include/llvm/Analysis/TargetTransformInfo.h` -- cost model query enums
- `llvm/include/llvm/Analysis/ScalarEvolution.h` -- SCEV expression types
- `llvm/include/llvm/Analysis/ValueTracking.h` -- known-bits analysis
- `llvm/lib/Analysis/` -- alias analysis, scalar evolution, loop analysis, CFG analysis

#### Clang Frontend (Parsing & Semantics)

- `clang/include/clang/Basic/DiagnosticSemaKinds.td` -- semantic analysis diagnostic IDs
- `clang/include/clang/Basic/DiagnosticParseKinds.td` -- parser diagnostic IDs
- `clang/include/clang/Basic/DiagnosticDriverKinds.td` -- driver diagnostic IDs
- `clang/include/clang/Basic/DiagnosticCommonKinds.td` -- common diagnostic IDs
- `clang/include/clang/Basic/TokenKinds.def` -- lexer token kind enum
- `clang/include/clang/Basic/Attr.td` -- source attribute definitions
- `clang/include/clang/Basic/Specifiers.h` -- access/storage/type specifier enums
- `clang/include/clang/Basic/OperatorKinds.def` -- overloaded operator kinds
- `clang/include/clang/Basic/LangOptions.def` -- language option flags
- `clang/include/clang/Basic/TargetCXXABI.def` -- C++ ABI kinds

#### Clang AST & CodeGen

- `clang/include/clang/AST/OperationKinds.def` -- cast/unary/binary operation kinds
- `clang/include/clang/AST/Type.h` -- AST type class hierarchy
- `clang/include/clang/AST/Decl.h` -- declaration node types
- `clang/include/clang/AST/BuiltinTypes.def` -- built-in type kind enum
- `clang/lib/CodeGen/` -- AST-to-LLVM-IR emission (CGExpr, CGStmt, CGCall, CGBuiltin)
- `clang/lib/Sema/` -- semantic analysis, overload resolution, template deduction
- `clang/lib/Parse/` -- recursive-descent parser
- `clang/lib/AST/` -- AST construction, dumping, import

#### Clang Driver

- `clang/lib/Driver/` -- compilation pipeline orchestration, toolchain selection
- `clang/lib/Driver/ToolChains/` -- per-platform toolchain implementations
- `clang/include/clang/Driver/` -- driver option definitions, phase enums

#### Linker (lld)

- `lld/ELF/` -- ELF linker: input files, relocations, linker scripts, ICF
- `lld/COFF/` -- COFF/PE linker: import libraries, debug types, DLL support
- `lld/MachO/` -- Mach-O linker
- `lld/wasm/` -- WebAssembly linker
- `lld/Common/` -- shared linker infrastructure

#### Sanitizer Runtimes (compiler-rt)

- `compiler-rt/lib/asan/` -- AddressSanitizer: error reporting, shadow mapping, interceptors
- `compiler-rt/lib/tsan/rtl/` -- ThreadSanitizer: race detection, synchronization interception
- `compiler-rt/lib/msan/` -- MemorySanitizer: uninitialized memory tracking
- `compiler-rt/lib/ubsan/` -- UndefinedBehaviorSanitizer: check handlers, type checks
- `compiler-rt/lib/sanitizer_common/` -- shared runtime: allocators, symbolizer, stack traces
- `compiler-rt/lib/dfsan/` -- DataFlowSanitizer: taint propagation
- `compiler-rt/lib/fuzzer/` -- libFuzzer: coverage-guided fuzz engine

#### Target Backends

- `llvm/lib/Target/X86/` -- x86/x86-64 instruction selection, register info, calling conv
- `llvm/lib/Target/AArch64/` -- AArch64/ARM64 backend
- `llvm/lib/Target/ARM/` -- 32-bit ARM backend
- `llvm/lib/Target/RISCV/` -- RISC-V backend
- `llvm/lib/Target/AMDGPU/` -- AMD GPU backend (GCN/RDNA)
- `llvm/lib/Target/NVPTX/` -- NVIDIA PTX backend

#### LTO & Bitcode

- `llvm/lib/LTO/` -- link-time optimization orchestration
- `llvm/lib/Bitcode/` -- bitcode reader/writer
- `llvm/include/llvm/Bitcode/` -- bitcode format constants

#### JIT & Execution Engine

- `llvm/lib/ExecutionEngine/Orc/` -- ORC JIT layers, lazy compilation
- `llvm/lib/ExecutionEngine/MCJIT/` -- legacy MC-based JIT
- `llvm/lib/ExecutionEngine/RuntimeDyld/` -- runtime dynamic linker for JIT
- `llvm/include/llvm/ExecutionEngine/Orc/` -- ORC API: ExecutionSession, MaterializationUnit

#### MLIR (Multi-Level IR)

- `mlir/include/mlir/IR/` -- MLIR core IR types, operations, attributes
- `mlir/include/mlir/Dialect/` -- dialect definitions (Arith, Linalg, SCF, Vector, etc.)
- `mlir/lib/Dialect/` -- dialect implementations
- `mlir/lib/Transforms/` -- MLIR-level transformations
