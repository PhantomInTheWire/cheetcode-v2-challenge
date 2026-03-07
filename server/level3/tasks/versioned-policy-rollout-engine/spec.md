# Versioned Policy Rollout Engine

> **Goal**: Implement an in-memory policy rollout engine that preserves authorization behavior across version rollout, staged activation, fallback-to-previous-version reads, stale snapshots, and operator explainability.

## Interface

Your submission must provide the following exported functions and C-compatible struct:

```c
typedef struct PolicyExplainView {
  int exists;
  int matched_snapshot_id;
  int decided_version;
  int allow_mask;
  int deny_mask;
  int fallback_used;
  int stale_snapshot;
  int disabled_snapshot;
  int usable;
} PolicyExplainView;

void policy_reset(void);
int policy_publish_snapshot(
  int snapshot_id,
  int version,
  int subject_id,
  int resource_id,
  int allow_mask,
  int deny_mask,
  int priority,
  int64_t not_before_ts,
  int64_t expires_ts
);
int policy_set_subject_binding(int subject_id, int active_version, int fallback_version);
int policy_stage_version(int subject_id, int staged_version);
int policy_activate_version(int subject_id);
int policy_retire_snapshot(int snapshot_id);
int policy_disable_snapshot(int snapshot_id);
int policy_check(int subject_id, int resource_id, int perm_bit, int64_t ts);
int policy_explain_get(int subject_id, int resource_id, int perm_bit, int64_t ts, PolicyExplainView* out_view);
int policy_count_subject_rules(int subject_id, int64_t ts);
int policy_last_error(void);
```

## Starter Template Note

- The starter is intentionally minimal and includes only light scaffolding.
- Full conformance is required: hidden validation checks the full behavior in this specification.

## Version Model

- Snapshots are immutable policy records identified by unique `snapshot_id`.
- Each snapshot belongs to exactly one `version`, `subject_id`, and `resource_id`.
- Subject bindings select an `active_version` and an optional `fallback_version`.
- `policy_stage_version` records a pending version for a subject.
- `policy_activate_version` promotes the staged version to active and shifts the previous active version into the fallback slot.
- Multiple versions may coexist in storage; reads must preserve behavior while old and new snapshots both exist.

## Policy Semantics

- Permission bits are opaque bitmasks; `policy_check` authorizes when `perm_bit` is allowed and not explicitly denied.
- Snapshots are usable only when `not_before_ts <= ts < expires_ts`, not retired, and not disabled.
- When multiple usable snapshots match the same subject/resource/version, the highest `priority` wins.
- Explicit deny bits override allow bits within the chosen snapshot.
- Reads first evaluate the active version.

## Compatibility and Fallback Rules

- If the active version has no usable matching snapshot for the subject/resource pair, the fallback version is consulted.
- Fallback is also required when the active version has only stale or disabled matches for the pair.
- If the active version has a usable matching snapshot, that snapshot shadows fallback even when it denies the requested permission.
- Fallback never merges with the active version; one version wins the read.
- `policy_count_subject_rules` counts currently usable snapshots reachable through the subject's active and fallback versions.

## Explain Contract

- `policy_explain_get` returns `1` for known subjects with a binding or known snapshots for the subject; otherwise `0`.
- The explain payload must expose:
  - `exists`
  - `matched_snapshot_id`
  - `decided_version`
  - `allow_mask`
  - `deny_mask`
  - `fallback_used`
  - `stale_snapshot`
  - `disabled_snapshot`
  - `usable`
- `stale_snapshot` and `disabled_snapshot` report whether active-version matches existed but could not be used.

## Update Semantics

- `policy_retire_snapshot` permanently removes a snapshot from read consideration while remaining explain-visible.
- `policy_disable_snapshot` temporarily disables a snapshot.
- Duplicate snapshot ids, unknown subjects for activation, unknown snapshots, and null explain pointers must produce stable differentiated errors.

## Scale Expectations

- Hidden validation includes large irrelevant populations, hot repeated reads, mixed old/new policy data, and repeated operator-style explain queries.
- Passing requires preserving correctness under version skew, fallback rules, stale-state handling, and rollout transitions.
