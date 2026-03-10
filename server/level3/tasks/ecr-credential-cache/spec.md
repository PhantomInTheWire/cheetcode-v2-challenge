## Title

Registry credential cache mishandles public/private classification, expiry refresh, and blocked refresh fallbacks

## Problem Description

The current credential cache works on the happy path but breaks once registry classification and expiry-driven refreshes interact. The real maintainer-facing bug is not just "refresh failed": it is a sequence of behaviors where a cached token is reused for a while, the registry kind changes underneath it, expiry forces a refresh, the backing client errors, and operators are left with audit output that does not clearly explain whether the stale token was kept, replaced, or rendered unusable.

This task mirrors the concrete failure mode of container registry auth code where public and private registry handling diverge, cached credentials mask the issue for some time, and the break only appears on the first refresh boundary.

## Reproduction Shape

One realistic reproduction looks like this:

1. Configure two registries with different credential backends.
2. Seed both with valid cached tokens.
3. Read one registry while the token is still valid and confirm it reuses the cache.
4. Force expiry and refresh successfully for one registry.
5. Force expiry on the other registry while the client is returning an error.
6. Reclassify a registry after caching a token and ensure the still-valid token is not discarded purely because of the classification change.

The important part is that maintainers need enough state after the failure to understand whether the bug was caused by unknown registry configuration, stale cache reuse, or a refresh path that refused to mint a replacement.

## Actual Behavior

- Valid cached tokens can hide broken refresh logic until the first expiry boundary.
- Registry kind changes may accidentally invalidate a token that should still be reusable until expiry.
- A client-side refresh error can mutate cache state in subtle ways, making follow-up debugging harder.
- Summary and audit views tend to disagree once some credentials are expired, errored, or recently refreshed.

## Expected Behavior

- A non-expired cached token must be returned without contacting the refresh path.
- An expired token must refresh deterministically when the registry is configured and the client is healthy.
- If refresh is blocked by a client error, the call must fail without overwriting the existing token id or refresh counter.
- Reclassifying a registry must not destroy an already-cached still-valid token on its own.
- Audit output must distinguish "cached and usable", "cached but expired", and "refresh currently blocked by client error".

Registry Classification

- Each registry id belongs to exactly one configured kind.
- Unknown registries must fail reads until configured.
- Only configured, supported registry kinds are usable for refresh.
- Classification affects refresh behavior and usability, but not whether an already-cached still-valid token may be returned.

Cache Rules

- `cred_get(registry_id, now_ts)` returns the current token id on success and `0` on failure.
- A non-expired cached token must be returned directly.
- When the cached token is expired and no client error is set, `cred_get` must refresh deterministically and cache the refreshed token.
- When the cached token is expired and a client error is set, `cred_get` must fail without changing the cached token id or refresh counter.
- `cred_force_expire` marks the current entry expired without deleting the prior token id.
- Injecting a new token replaces the prior cached token for that registry only.

Audit Contract

- `cred_audit_get` returns `1` for known registries and `0` otherwise.
- The audit payload must expose:
  - `exists`
  - `registry_kind`
  - `cached`
  - `expired`
  - `client_error`
  - `token_id`
  - `refresh_count`
  - `usable`
- Audit must preserve enough state for an operator to understand why a read failed after a successful earlier read.
- A null audit pointer must fail with a stable error rather than being ignored.

**Interface**: Your submission must provide the following exported functions and C-compatible struct:

```c
typedef struct CredAuditView {
  int exists;
  int registry_kind;
  int cached;
  int expired;
  int client_error;
  int token_id;
  int refresh_count;
  int usable;
} CredAuditView;

void cred_reset(void);
int cred_set_registry_kind(int registry_id, int registry_kind);
int cred_inject_token(int registry_id, int token_id, int64_t expires_ts);
int cred_get(int registry_id, int64_t now_ts);
int cred_force_expire(int registry_id);
int cred_set_client_error(int registry_id, int error_code);
int cred_audit_get(int registry_id, int64_t now_ts, CredAuditView* out_view);
int cred_count_cached(int64_t now_ts);
int cred_last_error(void);
```

Error Reporting

- Unknown registries, unsupported registry kinds, and null audit pointers must produce stable differentiated errors.
- Unknown audit targets should return `0` without fabricating partial cache state.

Scale Expectations

- Hidden validation includes repeated hot reads against a small hot set, large irrelevant registry populations, repeated expiry/refresh cycles, and audit/summary reads performed immediately after refresh failures.
- Passing requires the cache to remain coherent after many reads and many refresh boundaries, not just for one initial token.
