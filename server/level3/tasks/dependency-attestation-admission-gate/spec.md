**Goal**: Implement an in-memory admission gate that decides whether a service may roll out into an environment based on dependency health, attestations, waivers, block state, and transitive failure propagation.

**Interface**: Your submission must provide the following exported functions and C-compatible struct:

```c
typedef struct GateAuditView {
  int exists;
  int rollout_enabled;
  int attested;
  int waiver_active;
  int blocked_direct;
  int blocked_transitive;
  int stale_attestation;
  int conflicting_evidence;
  int admissible;
} GateAuditView;

void gate_reset(void);
int gate_register_service(int service_id);
int gate_set_dependency(int service_id, int dependency_id);
int gate_report_attestation(int service_id, int environment_id, int status, int64_t observed_ts, int64_t valid_until_ts);
int gate_set_environment_rollout(int service_id, int environment_id, int enabled);
int gate_add_waiver(int service_id, int environment_id, int64_t valid_until_ts);
int gate_block_service(int service_id, int blocked);
int gate_check_admission(int service_id, int environment_id, int64_t ts);
int gate_audit_get(int service_id, int environment_id, int64_t ts, GateAuditView* out_view);
int gate_count_admissible(int environment_id, int64_t ts);
int gate_last_error(void);
```

Dependency Graph Model

- Services form a directed dependency graph.
- Admission for a service depends on the service itself and all transitive dependencies.
- A direct or transitive block always denies admission.

Waiver Rules

Conflicting Evidence Rules

- Attestations are per service and environment.
- `status=1` means healthy; `status=0` means unhealthy.
- A healthy attestation is usable only while `ts < valid_until_ts`.
- If healthy and unhealthy attestations are both simultaneously valid for the same service/environment pair, the result is conflicting evidence and admission must fail.
- An active waiver may bypass missing or stale healthy attestations, but never bypass a direct or transitive block.
- An active waiver also may not bypass conflicting evidence.

Audit Contract

Environment Rollout Rules

- `gate_set_environment_rollout` enables or disables admission in a specific environment.
- Partial environment rollout is expected: one environment may admit while another denies.
- `gate_audit_get` must expose whether denial came from stale evidence, conflicting evidence, direct block, or transitive block.

Scale Expectations

- Hidden validation includes large irrelevant service populations, repeated operator audit queries, noisy dependency graphs, and repeated admission reads over stale and conflicting evidence.
- Passing requires correctness under transitive dependency drift, waiver expiry, conflicting attestations, and partial environment rollout.
