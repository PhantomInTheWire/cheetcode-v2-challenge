# PostgreSQL Configuration

## Project: PostgreSQL

Source: `/Users/ghost/postgres`
Output: `data/pg-questions.json`
Extensions: `*.c, *.h`
ID Prefix: `pg_`

### Architecture Layers

PostgreSQL has a well-defined layer cake. Questions describe the top; answers live at the bottom.

```
SQL query / client command (libpq wire protocol)
  -> Parser / Analyzer (raw parse tree -> analyzed query tree)
    -> Rewriter (query tree -> rewritten query tree via rules)
      -> Planner / Optimizer (query tree -> execution plan tree)
        -> Executor (plan nodes -> tuple stream)
          -> Access Methods / Table AM / Index AM
            -> Buffer Manager / Storage Manager / WAL
              -> THE ANSWER: enum/error/constant
```

### Synonym Table

| Internal Term | Use Instead |
| --- | --- |
| WAL (write-ahead log) | durability journal |
| XLOG | durability journal subsystem |
| MVCC | multi-version snapshot isolation |
| vacuum | dead-row reclamation sweep |
| autovacuum | automatic dead-row reclamation daemon |
| checkpoint | durability synchronization barrier |
| bgwriter | background dirty-page flusher |
| walwriter | journal flush daemon |
| shared_buffers | communal page pool |
| tuple | row record |
| heap | unordered row-storage file |
| index | sorted lookup accelerator |
| B-tree | balanced sorted tree accelerator |
| GiST | generalized search tree accelerator |
| GIN | inverted posting-list accelerator |
| SP-GiST | space-partitioned search tree accelerator |
| BRIN | block-range summary accelerator |
| hash index | bucket-chain lookup accelerator |
| TOAST | oversized-value out-of-line storage |
| tablespace | designated storage volume |
| relation | database object handle (table/index/sequence) |
| relfilenode / relfilenumber | physical file identifier |
| OID | internal numeric object identifier |
| catalog | system metadata tables |
| pg_class | master object registry table |
| pg_attribute | column definition registry |
| pg_type | data type registry |
| pg_proc | function registry |
| planner / optimizer | query execution strategizer |
| executor | query execution engine |
| SeqScan | full-table sequential traversal |
| IndexScan | accelerator-driven row lookup |
| BitmapScan | two-phase accelerator-then-heap traversal |
| HashJoin | bucket-partitioned row matching |
| MergeJoin | sorted-stream row matching |
| NestLoop | nested iteration row matching |
| Gather / GatherMerge | parallel worker result collector |
| Agg | grouping accumulator |
| WindowAgg | sliding-frame accumulator |
| Sort | row ordering step |
| Limit | row count truncation step |
| ModifyTable | data mutation dispatcher |
| Append | union concatenation step |
| logical replication | row-level change propagation stream |
| physical replication | byte-level journal replay |
| walsender | journal transmission process |
| walreceiver | journal reception process |
| replication slot | journal consumption bookmark |
| pg_dump | database export serializer utility |
| pg_basebackup | full-cluster cloning utility |
| pg_upgrade | major-version migration utility |
| pg_rewind | diverged-timeline resynchronization utility |
| pg_ctl | server lifecycle control utility |
| psql | interactive query terminal |
| libpq | client wire-protocol library |
| FDW (foreign data wrapper) | remote-table proxy adapter |
| extension | loadable add-on module |
| contrib module | bundled optional add-on |
| PL/pgSQL | embedded procedural scripting language |
| LISTEN / NOTIFY | asynchronous inter-session signaling |
| advisory lock | application-defined cooperative lock |
| predicate lock | serializable-isolation conflict detector |
| lwlock (lightweight lock) | internal subsystem latch |
| spinlock | hardware-level busy-wait lock |
| buffer pin | page-reference hold |
| CLOG (commit log) | transaction outcome ledger |
| SLRU (simple least-recently-used) | segmented fixed-cache paging layer |
| visibility map | all-visible page bitmap |
| free space map | available-capacity page tracker |
| postmaster | connection supervisor process |
| backend process | per-session worker process |
| background worker | auxiliary server task process |
| SPI (server programming interface) | in-server query invocation interface |
| trigger | row-event callback hook |
| event trigger | schema-change callback hook |
| rule | query-rewriting substitution rule |
| CTE (common table expression) | named inline sub-query block |
| partitioning | range/list/hash table subdivision |
| pg_hba.conf | client authentication rulebook |
| SCRAM | salted challenge-response credential exchange |
| SSL / TLS | encrypted transport channel |
| GEQO | genetic evolution query join optimizer |
| JIT (just-in-time compilation) | runtime native-code generation |
| HOT (heap-only tuple) | in-page row version chain |
| XID wraparound | transaction counter overflow |
| multixact | shared row-lock holder group |
| two-phase commit | distributed prepare-then-finalize protocol |
| savepoint | nested transaction restoration point |
| recovery | crash-restart journal replay |
| standby | read-only replica server |
| timeline | recovery history branch |
| injection point | developer-inserted test hook |
| wait event | observable process stall classification |
| resource owner | per-operation resource tracking scope |

### Hotspot Areas

#### Nodes / Plan Types / Parse Trees

- `src/include/nodes/nodes.h` -- NodeTag enum (all node types)
- `src/include/nodes/nodetags.h` -- generated node tag assignments
- `src/include/nodes/parsenodes.h` -- parse tree enums (QuerySource, SortByDir, SetQuantifier, ObjectType, etc.)
- `src/include/nodes/primnodes.h` -- primitive expression enums (OnCommitAction, CoercionForm, BoolExprType, etc.)
- `src/include/nodes/pathnodes.h` -- planner path enums (CostSelector, UpperRelationKind, RelOptKind)
- `src/include/nodes/plannodes.h` -- plan tree structures and CmdType
- `src/include/nodes/execnodes.h` -- executor state nodes
- `src/include/nodes/lockoptions.h` -- row-level lock strength enums

#### Transaction / WAL / XLOG

- `src/include/access/xact.h` -- isolation levels (XACT_*), SyncCommitLevel, transaction events
- `src/include/access/xlog.h` -- WAL-level enums, recovery states
- `src/include/access/xlogrecord.h` -- WAL record header format
- `src/include/access/xlogdefs.h` -- LSN, TimeLineID types
- `src/include/access/xlogrecovery.h` -- recovery target types and actions
- `src/include/access/rmgrlist.h` -- WAL resource manager IDs (RM_XLOG_ID, RM_HEAP_ID, etc.)
- `src/include/access/heapam_xlog.h` -- heap WAL opcodes (XLOG_HEAP_INSERT, _DELETE, _UPDATE, HOT_UPDATE, etc.)
- `src/include/access/nbtxlog.h` -- B-tree WAL opcodes
- `src/include/access/clog.h` -- transaction status values
- `src/include/access/transam.h` -- transaction ID constants, frozen XID

#### Storage / Locking / Buffer Manager

- `src/include/storage/lockdefs.h` -- table lock modes (AccessShareLock through AccessExclusiveLock)
- `src/include/storage/lock.h` -- LOCKTAG types, lock methods, deadlock states
- `src/include/storage/lwlock.h` -- lightweight lock wait states, tranche IDs
- `src/include/storage/buf_internals.h` -- buffer state flags, buffer descriptors
- `src/include/storage/bufmgr.h` -- buffer access strategy types
- `src/include/storage/smgr.h` -- storage manager interface
- `src/include/storage/predicate.h` -- serializable isolation predicate lock types
- `src/include/storage/sinval.h` -- shared invalidation message types
- `src/include/storage/procsignal.h` -- inter-process signal types
- `src/include/storage/dsm_impl.h` -- dynamic shared memory implementation types
- `src/include/storage/proc.h` -- PGPROC states

#### Catalog / Dependency / Object Types

- `src/include/catalog/dependency.h` -- DependencyType, SharedDependencyType, ObjectClass enums
- `src/include/catalog/pg_class.h` -- relation kinds (RELKIND_*), persistence types
- `src/include/catalog/pg_type.h` -- type categories, type alignment
- `src/include/catalog/pg_constraint.h` -- constraint types
- `src/include/catalog/pg_trigger.h` -- trigger type flags
- `src/include/catalog/pg_am.h` -- access method types
- `src/include/catalog/pg_cast.h` -- cast context types
- `src/include/catalog/pg_control.h` -- DB state, WAL level enums

#### Error Codes (SQLSTATE)

- `src/backend/utils/errcodes.txt` -- SQLSTATE error code definitions (generates errcodes.h)
- `src/include/utils/errcodes.h` -- generated ERRCODE_* macros
- `src/include/utils/elog.h` -- error levels (DEBUG through PANIC)

#### Executor / Plan Execution

- `src/backend/executor/execProcnode.c` -- plan node dispatch
- `src/backend/executor/execMain.c` -- executor entry points
- `src/backend/executor/nodeHashjoin.c` -- hash join state machine
- `src/backend/executor/nodeMergejoin.c` -- merge join state machine
- `src/backend/executor/nodeAgg.c` -- aggregation states
- `src/backend/executor/nodeModifyTable.c` -- INSERT/UPDATE/DELETE/MERGE dispatch
- `src/include/executor/execExpr.h` -- expression evaluation step types (ExprEvalOp)
- `src/include/executor/hashjoin.h` -- hash join phase enums

#### Optimizer / Planner

- `src/backend/optimizer/path/` -- join path generation, index path creation
- `src/backend/optimizer/plan/` -- plan tree creation, subquery planning
- `src/backend/optimizer/util/` -- path cost utilities, restrictinfo
- `src/backend/optimizer/geqo/` -- genetic query optimizer
- `src/include/optimizer/cost.h` -- cost model constants
- `src/include/optimizer/paths.h` -- path generation function signatures

#### Parser / Grammar

- `src/backend/parser/gram.y` -- SQL grammar (massive file with token/rule definitions)
- `src/backend/parser/scan.l` -- SQL lexer
- `src/include/parser/kwlist.h` -- keyword list (reserved/unreserved)
- `src/backend/parser/parse_coerce.c` -- type coercion logic
- `src/backend/parser/parse_expr.c` -- expression analysis

#### Replication / High Availability

- `src/include/replication/slot.h` -- ReplicationSlotPersistency, InvalidationCause enums
- `src/include/replication/walreceiver.h` -- WAL receiver states
- `src/include/replication/walsender.h` -- WAL sender states
- `src/include/replication/syncrep.h` -- synchronous replication wait modes
- `src/include/replication/logicalproto.h` -- logical replication protocol message types
- `src/include/replication/output_plugin.h` -- output plugin callback types
- `src/include/replication/reorderbuffer.h` -- change buffer action types
- `src/backend/replication/logical/snapbuild.c` -- snapshot build states
- `src/backend/replication/walsender.c` -- WAL sender state machine

#### Authentication / Client Connection

- `src/include/libpq/hba.h` -- UserAuth enum (uaReject, uaTrust, uaMD5, uaSCRAM, etc.), ConnType
- `src/include/libpq/auth.h` -- authentication exchange
- `src/include/libpq/protocol.h` -- wire protocol message types
- `src/include/libpq/pqcomm.h` -- connection communication primitives
- `src/include/libpq/sasl.h` -- SASL mechanism interface
- `src/interfaces/libpq/libpq-fe.h` -- ConnStatusType, ExecStatusType, PGTransactionStatusType (client-side enums)

#### Access Methods / Index Internals

- `src/include/access/amapi.h` -- access method API callbacks, amroutine
- `src/include/access/nbtree.h` -- B-tree page layout, split strategies
- `src/include/access/gin.h` -- GIN entry categories, posting tree
- `src/include/access/gist.h` -- GiST split strategies, page flags
- `src/include/access/spgist.h` -- SP-GiST inner/leaf tuple types
- `src/include/access/brin.h` -- BRIN opclass support
- `src/include/access/hash.h` -- hash index bucket/overflow page types
- `src/include/access/heapam.h` -- heap access method operations
- `src/include/access/tableam.h` -- table access method API (TU_* result codes)
- `src/include/access/htup_details.h` -- heap tuple infomask bits

#### Postmaster / Background Processes

- `src/backend/postmaster/postmaster.c` -- server startup states, fork dispatch
- `src/backend/postmaster/autovacuum.c` -- autovacuum worker states
- `src/backend/postmaster/bgwriter.c` -- background writer logic
- `src/backend/postmaster/checkpointer.c` -- checkpoint request flags
- `src/backend/postmaster/bgworker.c` -- background worker lifecycle
- `src/include/postmaster/bgworker.h` -- bgworker flags and notification states

#### Traffic Cop / Command Dispatch

- `src/include/tcop/cmdtaglist.h` -- command tags (CMDTAG_SELECT, CMDTAG_INSERT, etc.)
- `src/include/tcop/dest.h` -- CommandDest enum (DestNone, DestRemote, etc.)
- `src/backend/tcop/postgres.c` -- main backend loop, simple/extended query protocol
- `src/backend/tcop/utility.c` -- DDL/utility statement dispatch

#### Wait Events / Statistics

- `src/include/utils/wait_event.h` -- wait event classes (PG_WAIT_LWLOCK, PG_WAIT_LOCK, PG_WAIT_IO, etc.)
- `src/include/utils/wait_event_types.h` -- individual wait event enums
- `src/include/pgstat.h` -- statistics collector types, stat kinds
- `src/include/utils/backend_status.h` -- backend state enums (STATE_IDLE, STATE_RUNNING, etc.)
- `src/include/commands/progress.h` -- progress reporting parameter IDs

#### TOAST / Compression / Large Objects

- `src/include/access/toast_compression.h` -- ToastCompressionId, compression method chars
- `src/include/access/toast_internals.h` -- TOAST strategy flags
- `src/include/access/detoast.h` -- detoast fetch types
- `src/include/storage/large_object.h` -- large object constants

#### Contrib Extensions / FDW

- `contrib/postgres_fdw/` -- foreign data wrapper for remote PostgreSQL
- `contrib/pg_stat_statements/` -- query statistics tracking
- `contrib/pageinspect/` -- low-level page inspection functions
- `contrib/pg_buffercache/` -- shared buffer inspection
- `contrib/amcheck/` -- index consistency verification
- `contrib/pg_trgm/` -- trigram text similarity
- `contrib/pg_walinspect/` -- WAL record inspection

#### PL/pgSQL / Procedural Languages

- `src/pl/plpgsql/src/plpgsql.h` -- PL/pgSQL datum types, statement types, variable types
- `src/pl/plpgsql/src/pl_exec.c` -- PL/pgSQL executor
- `src/pl/plpgsql/src/pl_comp.c` -- PL/pgSQL compilation
- `src/pl/plpgsql/src/pl_gram.y` -- PL/pgSQL grammar
