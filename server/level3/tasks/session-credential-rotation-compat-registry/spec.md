# Session Credential Rotation Compat Registry

> **Goal**: Implement an in-memory session registry that preserves authentication behavior across staged credential generations, activation, revocation, grace windows for lagging clients, and operator audit reads.

## Interface

Your submission must provide the following exported functions and C-compatible struct:

```c
typedef struct SessionAuditView {
  int exists;
  int session_revoked;
  int active_generation;
  int staged_generation;
  int presented_generation;
  int grace_generation;
  int grace_active;
  int generation_revoked;
  int compatible;
  int usable;
} SessionAuditView;

void session_reset(void);
int session_create(int session_id, int subject_id, int resource_id, int active_generation);
int session_issue_credential(int credential_id, int session_id, int generation, int64_t issued_ts, int64_t expires_ts);
int session_stage_generation(int session_id, int generation, int64_t grace_until_ts);
int session_activate_generation(int session_id, int64_t ts);
int session_revoke(int session_id, int generation);
int session_check(int session_id, int generation, int64_t ts);
int session_audit_get(int session_id, int generation, int64_t ts, SessionAuditView* out_view);
int session_count_active(int subject_id, int64_t ts);
int session_last_error(void);
```

## Generation Model

- Each session has one active generation and at most one staged generation.
- Activating a staged generation promotes it to active and records the previous active generation as the grace generation.
- Credentials are immutable and are valid only when their generation is currently usable for the session.

## Grace Window

- Activating a staged generation records the previous active generation as the grace generation.
- Grace state is session-scoped and applies only to the immediately previous active generation.
- Grace compatibility exists only while `ts < grace_until_ts`.

## Compatibility Windows

- Lagging clients may continue presenting the previous active generation until `grace_until_ts`.
- Grace compatibility never bypasses explicit revocation.
- Once the session itself is revoked, both active and grace generations must fail immediately.
- Reads must tolerate old and new generations coexisting in storage during rollout.

## Audit Contract

- `session_audit_get(session_id, generation, ts, out_view)` returns `1` for known sessions and `0` otherwise.
- The audit payload must expose whether the session exists, whether the whole session is revoked, which generation is active or staged, whether the presented generation is grace-compatible, and whether it is usable.
- Known sessions must remain audit-visible even when the presented generation is revoked or stale.

## Revocation and Audit Rules

- `session_revoke(session_id, -1)` revokes the entire session.
- `session_revoke(session_id, generation)` revokes only that generation.
- `session_audit_get` must report whether a presented generation is active, grace-compatible, revoked, or stale.
- Unknown sessions, duplicate credential ids, duplicate sessions, and null audit pointers must return differentiated errors.

## Scale Expectations

- Hidden validation includes large irrelevant populations, repeated hot checks, mixed stale and fresh credentials, and repeated operator audit scans.
- Passing requires correctness across activation transitions, grace windows, lagging clients, generation revocation, and noisy read paths.
