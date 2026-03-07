# Identity Bundle Auth Resolver

> **Goal**: Implement an in-memory identity resolver that enforces mission-critical authorization semantics under source precedence, delegation, revocation, time windows, and bundle key activation.

## Interface

Your submission must provide the following exported functions and C-compatible struct:

```c
typedef struct AuthAuditView {
  int exists;
  int source;
  int stored_mask;
  int effective_mask;
  int revoked;
  int requires_key;
  int key_attached;
  int not_yet_valid;
  int expired;
  int disabled_by_ancestor;
  int usable;
} AuthAuditView;

void auth_reset(void);
int auth_create_local_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable
);
int auth_import_bundle_grant(
  int grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable,
  int requires_key
);
int auth_attach_bundle_key(int grant_id);
int auth_delegate(
  int parent_grant_id,
  int child_grant_id,
  int subject_id,
  int resource_id,
  int perms_mask,
  int64_t not_before_ts,
  int64_t expires_ts,
  int delegatable,
  int requires_key
);
int auth_revoke(int grant_id);
int auth_check(int subject_id, int resource_id, int perm_bit, int64_t ts, int resolve_mode);
int auth_effective_mask(int grant_id, int64_t ts);
int auth_audit_get(int grant_id, int64_t ts, AuthAuditView* out_view);
int auth_count_usable(int subject_id, int64_t ts, int resolve_mode);
int auth_last_error(void);
```

## Starter Template Note

- The starter is intentionally minimal and includes only light scaffolding.
- Full conformance is required: hidden validation checks the full behavior in this specification.

## Constants

- Permission bits: `READ=1`, `WRITE=2`, `ADMIN=4`.
- `ADMIN` is independent. It does not imply `READ` or `WRITE`.
- Sources: `LOCAL_PROFILE=1`, `IDENTITY_BUNDLE=2`.
- Resolution modes: `LOCAL_ONLY=1`, `BUNDLE_ONLY=2`, `AUTO=3`.

## Resolver Model

- Grants are in-memory objects identified by unique `grant_id`.
- Each grant belongs to exactly one source and one resource.
- A grant may have a parent grant, forming a delegation chain.
- Time windows are inclusive at `not_before_ts` and exclusive at `expires_ts`.
- Revoked or otherwise unusable grants remain audit-visible.

## Grant Creation

- `auth_create_local_grant` creates a root grant in `LOCAL_PROFILE`.
- `auth_import_bundle_grant` creates a root grant in `IDENTITY_BUNDLE`.
- Local grants never require key attachment.
- Bundle grants with `requires_key=1` are audit-visible immediately but must deny authorization until `auth_attach_bundle_key(grant_id)` succeeds.
- `auth_attach_bundle_key` is valid only for existing bundle grants and is idempotent.
- Duplicate `grant_id` creation must fail, regardless of source.

## Delegation Semantics

- `auth_delegate` creates a child grant in the same source as the parent.
- Cross-source delegation is forbidden by construction.
- Delegation requires an existing, non-revoked, delegatable parent.
- Child grants may not widen permissions beyond the parent grant’s stored permission mask.
- Child grants may not begin earlier than the parent grant’s `not_before_ts`.
- Child grants may not expire later than the parent grant’s `expires_ts`.
- For bundle-sourced children, `requires_key` controls only the child’s own activation gate.
- Parent key material is **not** required at delegation time, but missing parent key material must still disable descendant authorization at evaluation time.

## Resolution Modes

- `auth_check(subject_id, resource_id, perm_bit, ts, resolve_mode)` returns `1` when the requested permission is authorized and `0` otherwise.
- `LOCAL_ONLY` considers only local grants.
- `BUNDLE_ONLY` considers only bundle grants.
- `AUTO` is the critical mode:
  - if the subject has at least one bundle grant anywhere in the resolver, only bundle grants may be considered for that subject;
  - otherwise only local grants may be considered.
- Source results are never merged. `AUTO` chooses one source; it does not union local and bundle grants.

## Usability Rules

- A grant is directly unusable when any of the following hold:
  - it is revoked;
  - `ts < not_before_ts`;
  - `ts >= expires_ts`;
  - it is a bundle grant with `requires_key=1` and no attached key.
- Descendants are unusable whenever any ancestor is revoked, not yet valid, expired, or missing required key material.
- `auth_effective_mask(grant_id, ts)` returns the usable permission mask for that exact grant at `ts`, or `0` when unusable.
- Effective permission masks are bounded by all ancestors in the chain.
- `auth_count_usable(subject_id, ts, resolve_mode)` counts only grants that would actually authorize under the chosen mode.

## Audit Contract

- `auth_audit_get(grant_id, ts, out_view)` returns `1` and fills `out_view` for existing grants, otherwise returns `0`.
- The audit payload must expose:
  - `exists`
  - `source`
  - `stored_mask`
  - `effective_mask`
  - `revoked`
  - `requires_key`
  - `key_attached`
  - `not_yet_valid`
  - `expired`
  - `disabled_by_ancestor`
  - `usable`
- `disabled_by_ancestor` must reflect ancestor-caused unusability and remain distinct from direct revocation on the current grant.
- For grants that do not require key material, `key_attached` must report `1`.

## Error Reporting

- Mutation helpers return `1` on success and `0` on failure.
- `auth_last_error()` must return the most recent resolver status code.
- Hidden validation expects stable differentiation between at least:
  - duplicate ids
  - unknown grants
  - wrong source for key attachment
  - non-delegatable parent
  - permission widening
  - child start before parent
  - child expiry after parent
  - null output pointer

## Evaluation Model

- Validation is black-box: hidden programs call the exported API and compare observable behavior against this specification.
- Hidden validation includes large irrelevant populations and repeated hot-path queries. Correctness alone is not sufficient if read paths degrade badly as stored grant volume grows.
- Passing requires conformance to source-precedence rules, temporal validity, activation gating, delegation bounds, revoke propagation, audit visibility, and the fixed check matrix.
