# Distributed Flag Snapshot Rollout Engine

> **Goal**: Implement an in-memory distributed flag rollout engine that preserves evaluation behavior across versioned snapshots, environment-scoped activation, staged rollout, fallback-to-previous-version reads, stale replica state, prerequisite dependencies, tombstones, and operator explainability.

## Problem Description

This task is shaped around the soul of a real feature-flag control plane under rollout pressure, not around the pleasant surface API most SDK users see.

The hard part is not toggling a boolean. The hard part is preserving deterministic evaluation while:

- old and new snapshots coexist;
- some environments have activated a version while others are still staged;
- stale replica state is visible and must affect reads in a controlled way;
- rules can shadow each other by priority and segment specificity;
- prerequisites can deny a flag even when the local flag would otherwise allow it;
- tombstones must block fallback in some cases but not all;
- audit reads need to explain whether a result came from active data, fallback data, or a stale-path safety decision.

Hidden validation treats this as a control-plane consistency problem with ugly edge cases, not as a toy rule engine.

## Interface

Your submission must provide the following exported functions and C-compatible structs:

```c
typedef struct FlagEvalView {
  int exists;
  int environment_id;
  int decided_version;
  int matched_snapshot_id;
  int matched_rule_id;
  int decided_variant_id;
  int fallback_used;
  int tombstone_blocked;
  int stale_active_seen;
  int disabled_active_seen;
  int prerequisite_failed;
  int off_by_targeting;
  int usable;
} FlagEvalView;

void flag_reset(void);

int flag_define(int flag_id, int default_variant_id, int off_variant_id);
int flag_define_prerequisite(int flag_id, int prerequisite_flag_id, int required_variant_id);

int flag_publish_snapshot(
  int snapshot_id,
  int flag_id,
  int environment_id,
  int version,
  int rule_id,
  int segment_id,
  int priority,
  int variant_id,
  int rollout_percent,
  int track_events,
  int64_t not_before_ts,
  int64_t expires_ts
);

int flag_publish_tombstone(
  int tombstone_id,
  int flag_id,
  int environment_id,
  int version,
  int64_t not_before_ts,
  int64_t expires_ts
);

int flag_stage_version(int flag_id, int environment_id, int version);
int flag_activate_version(int flag_id, int environment_id);
int flag_set_fallback_version(int flag_id, int environment_id, int version);

int flag_disable_snapshot(int snapshot_id);
int flag_retire_snapshot(int snapshot_id);
int flag_mark_replica_stale(int flag_id, int environment_id, int version, int stale);

int flag_register_segment_membership(int subject_id, int segment_id, int member);

int flag_evaluate(
  int flag_id,
  int environment_id,
  int subject_id,
  int subject_bucket,
  int64_t ts
);

int flag_explain_get(
  int flag_id,
  int environment_id,
  int subject_id,
  int subject_bucket,
  int64_t ts,
  FlagEvalView* out_view
);

int flag_count_usable_snapshots(int flag_id, int environment_id, int64_t ts);
int flag_last_error(void);
```

## Starter Template Note

- The starter is intentionally minimal and includes only light scaffolding.
- Full conformance is required: hidden validation checks the full behavior in this specification.

## Core Model

- A flag is identified by `flag_id`.
- Each flag has:
  - a `default_variant_id` used when the flag is on but no rule matches;
  - an `off_variant_id` used when the flag is effectively off.
- Snapshots are immutable targeting records identified by unique `snapshot_id`.
- Tombstones are immutable records that explicitly state that a version for a flag/environment must be considered deleted for read selection.
- Reads happen against exactly one `(flag_id, environment_id)` pair at a time.
- Versions are integers and are environment-scoped. The same flag may have different active versions in different environments.

## Targeting Model

- Each snapshot belongs to exactly one:
  - `flag_id`
  - `environment_id`
  - `version`
  - `rule_id`
  - `segment_id`
- `segment_id=0` means the snapshot applies to all subjects.
- `segment_id>0` means the subject must currently be a member of that segment.
- `rollout_percent` is an integer from `0` to `100`.
- A snapshot matches a subject only when:
  - the subject satisfies the segment requirement;
  - `subject_bucket` is within rollout;
  - the snapshot is temporally usable;
  - the snapshot is neither retired nor disabled.

### Rollout Semantics

- `subject_bucket` is supplied by the caller and is stable for a subject in a test trace.
- A snapshot matches rollout when `subject_bucket < rollout_percent`.
- `rollout_percent=0` means no subject matches.
- `rollout_percent=100` means every eligible subject matches.

### Rule Precedence

- When multiple usable snapshots exist in the chosen version:
  - higher `priority` wins;
  - if priorities tie, a segment-specific snapshot (`segment_id>0`) beats a global snapshot (`segment_id=0`);
  - if still tied, the lower `rule_id` wins;
  - if still tied, the lower `snapshot_id` wins.
- Reads must be deterministic under equal-looking data.

## Version Binding Model

- Each `(flag_id, environment_id)` pair has:
  - one active version;
  - at most one staged version;
  - an optional fallback version.
- `flag_stage_version` records a pending version.
- `flag_activate_version` promotes the staged version to active and shifts the previously active version into the fallback slot.
- `flag_set_fallback_version` explicitly changes the fallback version and may point to any known version for the same flag/environment.
- Reads always try the active version first.

## Snapshot Usability

- A snapshot is directly unusable when any of the following hold:
  - `ts < not_before_ts`;
  - `ts >= expires_ts`;
  - it was retired;
  - it was disabled.
- Disabled and retired snapshots remain explain-visible.
- `flag_disable_snapshot` is reversible only via `flag_reset`; this task models the operationally ugly case where once a bad snapshot is disabled, reads must route around it.
- `flag_retire_snapshot` permanently removes the snapshot from read consideration while keeping it explain-visible.

## Tombstone Semantics

- A tombstone applies to one exact `(flag_id, environment_id, version)`.
- Tombstones are considered after active-version selection but before fallback selection.
- If the active version has a usable tombstone at `ts`, that active version is considered explicitly deleted for the read.
- If the fallback version has a usable tombstone at `ts`, fallback must not consult snapshots from that version.
- Tombstones do not themselves produce a variant. They only suppress version selection.
- Hidden validation distinguishes:
  - "no usable snapshot in active version"
  - "active version existed but was tombstoned"
  - "fallback existed but was tombstoned"

## Replica-Staleness Semantics

- `flag_mark_replica_stale(flag_id, environment_id, version, stale)` marks whether reads must treat that version as replica-stale.
- A stale version is visible to explain reads but is unsafe for normal evaluation.
- If the active version is marked stale, reads must not use active snapshots and may fall back.
- If the fallback version is marked stale, fallback must not be used.
- If both active and fallback versions are stale or otherwise unusable, evaluation must return the `off_variant_id`.
- Staleness is per `(flag_id, environment_id, version)`, not global.

## Evaluation Semantics

`flag_evaluate(flag_id, environment_id, subject_id, subject_bucket, ts)` returns the decided `variant_id`.

### Decision Procedure

1. Resolve the chosen version:
   - examine the active version first;
   - if the active version is stale, fully disabled, tombstoned, or has no usable matching snapshot, consider fallback;
   - if the active version has at least one usable matching snapshot, that version wins even if the chosen result is the flag's `off_variant_id`.
2. Within the chosen version, choose the winning snapshot by precedence.
3. If the version wins but no rule matches:
   - the result is `default_variant_id` if the version has any usable snapshot population for the flag;
   - otherwise version selection fails and the engine may consider fallback.
4. After local version/rule selection, enforce prerequisites.
5. If a prerequisite fails, the result is the current flag's `off_variant_id`.

### Important Constraint

- Source results are never merged across versions.
- Reads choose one version. They do not union active and fallback rules.

## Prerequisite Semantics

- A flag may depend on zero or more prerequisite flags.
- `flag_define_prerequisite(flag_id, prerequisite_flag_id, required_variant_id)` adds one prerequisite edge.
- All prerequisites must evaluate to `required_variant_id` in the same environment, subject, bucket, and timestamp.
- Prerequisites are evaluated using the same rollout engine semantics, including fallback, tombstones, and staleness.
- If any prerequisite fails, the dependent flag must return its `off_variant_id`, even if the local flag would otherwise evaluate to another variant.
- Prerequisite failure must be explain-visible.
- Hidden validation includes multi-hop prerequisite chains.

### Cycle Rules

- Cycles are invalid.
- Introducing a prerequisite edge that would create a cycle must fail.
- Reads must never recurse forever, even under malformed mutation attempts.

## Explain Contract

- `flag_explain_get(...)` returns `1` for known flags and `0` otherwise.
- The explain payload must expose:
  - `exists`
  - `environment_id`
  - `decided_version`
  - `matched_snapshot_id`
  - `matched_rule_id`
  - `decided_variant_id`
  - `fallback_used`
  - `tombstone_blocked`
  - `stale_active_seen`
  - `disabled_active_seen`
  - `prerequisite_failed`
  - `off_by_targeting`
  - `usable`
- `off_by_targeting=1` means the chosen version was readable, but no usable rule matched the subject and the result therefore came from default/off semantics rather than a targeted variant.
- `usable=1` means the final decision path came from a readable version path; it does not mean the result is necessarily non-off.
- If a flag is known but no readable version path exists, explain must still return structured state with `usable=0`.

## Environment Scope and Isolation

- All bindings are environment-scoped.
- Publishing or activating a version in one environment must not affect another environment.
- Segment membership is global to the subject/segment pair and shared across environments.
- Hidden validation includes:
  - one environment with new active version;
  - one environment still on previous version;
  - one environment whose active version is stale and must fall back.

## Counting Semantics

- `flag_count_usable_snapshots(flag_id, environment_id, ts)` counts only snapshots that:
  - belong to the flag/environment;
  - are in the active or fallback version for that environment;
  - are temporally usable at `ts`;
  - are not retired;
  - are not disabled;
  - are not in versions blocked by active tombstones or stale markers.
- The count is for operator visibility, not for selecting a rule.

## Error Reporting

- Mutation helpers return `1` on success and `0` on failure unless otherwise stated.
- `flag_last_error()` must return the most recent engine status code.
- Hidden validation expects stable differentiation between at least:
  - duplicate flag ids
  - duplicate snapshot ids
  - duplicate tombstone ids
  - unknown flags
  - unknown snapshots
  - invalid rollout percent
  - unknown environment binding on activation
  - unknown prerequisite flag
  - prerequisite cycle creation
  - null explain pointer

## Evaluation Model

- Validation is black-box: hidden programs call the exported API and compare observable behavior against this specification.
- Hidden validation includes:
  - large irrelevant flag populations;
  - repeated hot reads against one flag/environment pair;
  - repeated explain queries over the same hot set;
  - mixed old/new versions in memory;
  - noisy segment membership updates unrelated to the queried flag;
  - prerequisite chains with unrelated branch noise;
  - stale-active plus tombstoned-fallback combinations intended to break simplistic fallback logic.
- Some scale buckets are budget-style checks over repeated loops and noisy populations. They are intentionally ratio-oriented rather than tied to one exact machine speed, but they still punish architectures that degrade badly as irrelevant state grows.
- Passing requires preserving deterministic rule selection, version isolation, fallback discipline, prerequisite correctness, tombstone handling, explain fidelity, and acceptable read-path scaling under noisy state.
