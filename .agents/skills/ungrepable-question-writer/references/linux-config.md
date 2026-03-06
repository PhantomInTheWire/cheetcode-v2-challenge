# Linux Kernel Configuration

## Project: Linux Kernel

Source: `/Users/ghost/linux`
Output: `data/linux-questions.json`
Extensions: `*.c, *.h, *.S`
ID Prefix: `linux_`

### Architecture Layers

The Linux kernel has a well-defined layer cake from user-space down to hardware. Questions describe the top; answers live at the bottom.

```
User-space program (syscall interface)
  -> VFS / socket / syscall dispatch layer (fs/, net/socket.c, kernel/sys.c)
    -> Subsystem core (e.g., ext4, TCP/IP stack, scheduler, netfilter)
      -> Shared kernel infrastructure (mm/, block/, crypto/, lib/)
        -> Architecture / hardware abstraction (arch/, drivers/)
          -> THE ANSWER: enum value, error code, or constant
```

### Synonym Table

| Internal Term            | Use Instead                                    |
| ------------------------ | ---------------------------------------------- |
| syscall                  | service gate request                           |
| inode                    | file identity record                           |
| dentry                   | name-to-object resolution cache entry          |
| superblock               | volume descriptor record                       |
| page fault               | memory page miss                               |
| OOM killer               | memory starvation reaper                       |
| cgroup                   | resource containment partition                 |
| namespace                | process isolation envelope                     |
| eBPF / BPF               | runtime-verified execution filter              |
| BPF verifier             | program safety proof engine                    |
| netfilter                | packet inspection gateway                      |
| conntrack                | connection state ledger                        |
| SELinux                  | mandatory access arbiter                       |
| AppArmor                 | pathname-based confinement enforcer            |
| Landlock                 | self-imposed privilege boundary                |
| LSM                      | pluggable security decision layer              |
| kthread                  | kernel-resident perpetual worker               |
| workqueue                | deferred task dispatch pool                    |
| tasklet                  | deferred interrupt completion unit             |
| softirq                  | low-priority deferred processor                |
| slab allocator           | fixed-geometry memory reservoir                |
| spinlock                 | busy-wait mutual exclusion primitive           |
| mutex                    | sleeping mutual exclusion primitive            |
| RCU                      | epoch-guarded deferred reclamation             |
| rwlock                   | shared-exclusive access guard                  |
| VFS                      | filesystem abstraction dispatch layer          |
| ext4                     | journaled extent-based volume format           |
| btrfs                    | copy-on-write tree-structured volume format    |
| XFS                      | high-throughput allocation-group volume format |
| NVMe                     | register-mapped storage command interface      |
| block layer              | storage request staging pipeline               |
| I/O scheduler            | storage request reordering arbiter             |
| io_uring                 | asynchronous submission ring interface         |
| DMA                      | peripheral-direct memory transfer              |
| IRQ                      | hardware signal line                           |
| page reclaim / vmscan    | dormant-page eviction sweep                    |
| huge page / THP          | enlarged memory frame                          |
| KSM                      | duplicate-page consolidation                   |
| NUMA                     | topology-aware memory region                   |
| cgroup memory controller | per-partition memory accounting enforcer       |
| TCP                      | reliable ordered byte stream channel           |
| socket                   | communication endpoint descriptor              |
| sk_buff / skb            | network message envelope                       |
| routing table / FIB      | destination resolution ledger                  |
| xfrm / IPsec             | cryptographic tunnel transformation            |
| SCTP                     | message-oriented reliable transport            |
| netlink                  | kernel-to-userspace notification conduit       |
| device driver            | peripheral control adapter                     |
| device tree              | hardware topology manifest                     |
| ftrace                   | dynamic function instrumentation framework     |
| kprobe                   | runtime instruction intercept point            |
| seccomp                  | service-gate restriction filter                |
| capability               | granular privilege token                       |
| signal                   | asynchronous process notification              |
| pipe                     | unidirectional byte conduit                    |
| epoll                    | scalable readiness notification collector      |
| futex                    | user-space fast mutual exclusion word          |
| cgroup freezer           | process group hibernation control              |
| PSI                      | resource contention pressure gauge             |
| writeback                | dirty-page flush orchestration                 |
| journaling / jbd2        | crash-recovery transaction log                 |

### Hotspot Areas

#### Error Codes & Drop Reasons

- `include/uapi/asm-generic/errno-base.h` -- base POSIX error numbers (EPERM through EPIPE)
- `include/uapi/asm-generic/errno.h` -- extended error numbers (EDEADLK through EHWPOISON)
- `include/net/dropreason-core.h` -- 260+ packet drop reason enums (SKB*DROP_REASON*\*)
- `include/net/rstreason.h` -- TCP reset reason enums (sk_rst_reason)

#### Memory Management

- `mm/oom_kill.c` -- OOM killer decision logic, oom_constraint enum
- `mm/vmscan.c` -- page reclaim / eviction scanning heuristics
- `mm/memory-failure.c` -- hardware memory error (poison) handling
- `mm/huge_memory.c` -- transparent huge page collapse/split edge cases
- `mm/migrate.c` -- page migration failure modes
- `mm/mmap.c` -- VMA manipulation, mmap error paths
- `include/linux/mm_types.h` -- vm_fault_reason enum, fault_flag enum, mmap_action_type
- `include/linux/vm_event_item.h` -- VM event counters (PGPGIN, PSWPOUT, etc.)

#### Scheduler

- `kernel/sched/core.c` -- task state transitions, scheduling class dispatch
- `kernel/sched/fair.c` -- CFS load balancing, bandwidth throttling
- `kernel/sched/deadline.c` -- SCHED_DEADLINE admission control, replenishment
- `kernel/sched/rt.c` -- real-time scheduling priority inversion handling
- `kernel/sched/psi.c` -- pressure stall information tracking
- `include/linux/sched.h` -- task states, uclamp_id enum, vtime_state

#### Filesystem — ext4

- `fs/ext4/ext4.h` -- ext4 mount flags, journal trigger types, allocation criteria enum
- `fs/ext4/mballoc.c` -- multiblock allocator error/edge paths
- `fs/ext4/fast_commit.c` -- fast commit journal replay error states
- `fs/ext4/super.c` -- mount/remount error handling, feature flag checks

#### Filesystem — btrfs

- `fs/btrfs/volumes.h` -- RAID types, chunk allocation policy, read policy enums
- `fs/btrfs/transaction.h` -- transaction state machine (btrfs_trans_state)
- `fs/btrfs/disk-io.c` -- tree root loading, superblock validation errors
- `fs/btrfs/scrub.c` -- data integrity verification error handling
- `fs/btrfs/relocation.c` -- block group relocation edge cases
- `fs/btrfs/space-info.c` -- space reservation / ENOSPC handling

#### Filesystem — XFS

- `fs/xfs/xfs_error.c` -- XFS error configuration and injection
- `fs/xfs/xfs_health.c` -- filesystem health tracking flags
- `fs/xfs/xfs_mount.h` -- mount flags and feature checks
- `fs/xfs/libxfs/` -- on-disk format validation, btree operations
- `fs/xfs/scrub/` -- online filesystem repair/scrub error states

#### Block Layer

- `include/linux/blk_types.h` -- req_op enum, request flag bits, bio write hints
- `block/blk-core.c` -- request queue error paths
- `block/blk-mq.c` -- multiqueue dispatch, tag allocation failures
- `block/bfq-iosched.c` -- BFQ I/O scheduler weight/priority edge cases
- `block/elevator.c` -- I/O scheduler selection and switching

#### Networking — TCP/IP

- `net/ipv4/tcp_input.c` -- TCP state machine, congestion control, SACK processing
- `net/ipv4/tcp_output.c` -- segment construction, window probe, retransmit
- `include/net/tcp_states.h` -- TCP socket state enum
- `net/ipv4/inet_connection_sock.c` -- connection establishment error paths
- `net/ipv6/` -- IPv6-specific extension header processing errors

#### Networking — Netfilter & Conntrack

- `net/netfilter/core.c` -- hook verdict processing, chain traversal
- `net/netfilter/nf_conntrack_core.c` -- connection tracking creation/destruction
- `net/netfilter/nf_conntrack_proto_tcp.c` -- TCP state tracking inside conntrack
- `net/netfilter/ipvs/` -- IP virtual server scheduling and state
- `include/net/netfilter/` -- netfilter internal header enums

#### Networking — xfrm / IPsec

- `net/xfrm/xfrm_state.c` -- SA state machine, expire, migration
- `net/xfrm/xfrm_policy.c` -- SPD lookup, bundle creation errors
- `net/xfrm/xfrm_input.c` -- inbound SA validation, replay protection
- `include/net/xfrm.h` -- xfrm enums, error codes, audit reasons

#### Security — SELinux

- `security/selinux/ss/services.c` -- security server AVC decisions, SID computation
- `security/selinux/hooks.c` -- LSM hook implementations, permission checks
- `security/selinux/ss/policydb.c` -- policy database loading/validation
- `security/selinux/include/objsec.h` -- security label object enums
- `security/selinux/avc.c` -- access vector cache lookup and audit

#### Security — AppArmor & Landlock

- `security/apparmor/domain.c` -- domain transition rules
- `security/apparmor/policy.c` -- profile loading/replacement errors
- `security/apparmor/file.c` -- file mediation permission checks
- `security/landlock/ruleset.h` -- landlock_key_type enum, rule layer checks
- `security/landlock/fs.c` -- filesystem access restriction enforcement

#### BPF Subsystem

- `kernel/bpf/verifier.c` -- program verification: register tracking, bounds checking, liveness
- `kernel/bpf/core.c` -- JIT dispatch, interpreter, runtime errors
- `kernel/bpf/syscall.c` -- bpf() syscall command dispatch, map/prog creation
- `include/uapi/linux/bpf.h` -- 38+ enums: bpf_cmd, bpf_map_type, bpf_prog_type, bpf_attach_type
- `kernel/bpf/btf.c` -- BTF type verification and validation

#### Crypto Subsystem

- `crypto/algapi.c` -- algorithm registration, template instantiation
- `crypto/api.c` -- algorithm lookup, module loading fallback
- `crypto/testmgr.c` -- self-test execution and failure reporting
- `crypto/drbg.c` -- deterministic random bit generator error paths
- `crypto/af_alg.c` -- userspace crypto socket interface errors

#### io_uring

- `io_uring/io_uring.c` -- submission/completion ring processing, CQE posting
- `io_uring/net.c` -- async networking operations, send/recv edge paths
- `io_uring/rw.c` -- async read/write, short read handling
- `include/uapi/linux/io_uring.h` -- io_uring_op enum, register ops, SQE flag bits

#### Device Drivers

- `drivers/nvme/host/nvme.h` -- NVMe controller state enum, quirk flags, I/O policy
- `drivers/nvme/host/core.c` -- NVMe command timeout, error recovery, namespace scanning
- `drivers/gpu/drm/` -- DRM/KMS mode-setting errors, atomic commit failures
- `drivers/scsi/` -- SCSI host/target error recovery, sense code mapping
- `drivers/block/` -- virtual block device error injection (null_blk, loop)

#### Kernel Core & Locking

- `kernel/locking/` -- lockdep validation, lock contention tracing
- `kernel/rcu/` -- RCU grace period machinery, stall detection
- `kernel/signal.c` -- signal delivery edge cases, siginfo fields
- `kernel/seccomp.c` -- seccomp filter return actions, notification errors
- `kernel/fork.c` -- process creation resource limits, clone flag validation
