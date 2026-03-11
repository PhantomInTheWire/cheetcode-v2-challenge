#include <cstdint>
#include <cstring>
extern "C" {
typedef struct GateAuditView {
  int exists, rollout_enabled, attested, waiver_active, blocked_direct,
      blocked_transitive, stale_attestation, conflicting_evidence, admissible;
} GateAuditView;
}
enum {
  G_MAX_SERVICES = 256,
  G_MAX_ATTEST = 2048,
  G_MAX_WAIVERS = 512,
  G_ERR_DUP = 1,
  G_ERR_UNKNOWN = 2,
  G_ERR_OUT = 3
};
struct Service {
  int used, id, blocked, dep_count, deps[8], rollout[8];
};
struct Attestation {
  int used, service_id, environment_id, status;
  int64_t observed_ts, valid_until_ts;
};
struct Waiver {
  int used, service_id, environment_id;
  int64_t valid_until_ts;
};
static Service services[G_MAX_SERVICES];
static Attestation attest[G_MAX_ATTEST];
static Waiver waivers[G_MAX_WAIVERS];
static int last_error = 0;
static Service *svc(int id) {
  for (int i = 0; i < G_MAX_SERVICES; i++)
    if (services[i].used && services[i].id == id)
      return &services[i];
  return nullptr;
}
static int env_slot(int env) { return env & 7; }
static int waiver_active(int service_id, int env, int64_t ts) {
  for (int i = 0; i < G_MAX_WAIVERS; i++)
    if (waivers[i].used && waivers[i].service_id == service_id &&
        waivers[i].environment_id == env && ts < waivers[i].valid_until_ts)
      return 1;
  return 0;
}
static void flags(int service_id, int env, int64_t ts, int *healthy,
                  int *unhealthy, int *stale) {
  *healthy = *unhealthy = *stale = 0;
  for (int i = 0; i < G_MAX_ATTEST; i++) {
    Attestation *a = &attest[i];
    if (!a->used || a->service_id != service_id || a->environment_id != env)
      continue;
    if (ts >= a->valid_until_ts) {
      if (a->status == 1)
        *stale = 1;
      continue;
    }
    if (a->status == 1)
      *healthy = 1;
    else
      *unhealthy = 1;
  }
}
static int admissible_inner(int service_id, int env, int64_t ts);
static int blocked_transitive(int service_id, int env, int64_t ts) {
  Service *s = svc(service_id);
  if (!s)
    return 0;
  for (int i = 0; i < s->dep_count; i++) {
    Service *d = svc(s->deps[i]);
    if (!d || d->blocked || !admissible_inner(d->id, env, ts))
      return 1;
  }
  return 0;
}
static int admissible_inner(int service_id, int env, int64_t ts) {
  int healthy, unhealthy, stale;
  Service *s = svc(service_id);
  if (!s || !s->rollout[env_slot(env)] || s->blocked ||
      blocked_transitive(service_id, env, ts))
    return 0;
  flags(service_id, env, ts, &healthy, &unhealthy, &stale);
  if (healthy && unhealthy)
    return 0;
  if (healthy)
    return 1;
  if (waiver_active(service_id, env, ts))
    return 1;
  return 0;
}
extern "C" __attribute__((visibility("default"))) void gate_reset(void) {
  std::memset(services, 0, sizeof(services));
  std::memset(attest, 0, sizeof(attest));
  std::memset(waivers, 0, sizeof(waivers));
  last_error = 0;
}
extern "C" __attribute__((visibility("default"))) int
gate_register_service(int service_id) {
  if (svc(service_id)) {
    last_error = G_ERR_DUP;
    return 0;
  }
  for (int i = 0; i < G_MAX_SERVICES; i++)
    if (!services[i].used) {
      services[i] = {};
      services[i].used = 1;
      services[i].id = service_id;
      return 1;
    }
  return 0;
}
extern "C" __attribute__((visibility("default"))) int
gate_set_dependency(int service_id, int dependency_id) {
  Service *s = svc(service_id);
  if (!s || !svc(dependency_id)) {
    last_error = G_ERR_UNKNOWN;
    return 0;
  }
  if (s->dep_count < 8)
    s->deps[s->dep_count++] = dependency_id;
  return 1;
}
extern "C" __attribute__((visibility("default"))) int
gate_report_attestation(int service_id, int environment_id, int status,
                        int64_t observed_ts, int64_t valid_until_ts) {
  if (!svc(service_id)) {
    last_error = G_ERR_UNKNOWN;
    return 0;
  }
  for (int i = 0; i < G_MAX_ATTEST; i++)
    if (!attest[i].used) {
      attest[i] = {1,      service_id,  environment_id,
                   status, observed_ts, valid_until_ts};
      return 1;
    }
  return 0;
}
extern "C" __attribute__((visibility("default"))) int
gate_set_environment_rollout(int service_id, int environment_id, int enabled) {
  Service *s = svc(service_id);
  if (!s) {
    last_error = G_ERR_UNKNOWN;
    return 0;
  }
  s->rollout[env_slot(environment_id)] = enabled ? 1 : 0;
  return 1;
}
extern "C" __attribute__((visibility("default"))) int
gate_add_waiver(int service_id, int environment_id, int64_t valid_until_ts) {
  if (!svc(service_id)) {
    last_error = G_ERR_UNKNOWN;
    return 0;
  }
  for (int i = 0; i < G_MAX_WAIVERS; i++)
    if (!waivers[i].used) {
      waivers[i] = {1, service_id, environment_id, valid_until_ts};
      return 1;
    }
  return 0;
}
extern "C" __attribute__((visibility("default"))) int
gate_block_service(int service_id, int blocked) {
  Service *s = svc(service_id);
  if (!s) {
    last_error = G_ERR_UNKNOWN;
    return 0;
  }
  s->blocked = blocked ? 1 : 0;
  return 1;
}
extern "C" __attribute__((visibility("default"))) int
gate_check_admission(int service_id, int environment_id, int64_t ts) {
  return admissible_inner(service_id, environment_id, ts);
}
extern "C" __attribute__((visibility("default"))) int
gate_audit_get(int service_id, int environment_id, int64_t ts,
               GateAuditView *out_view) {
  int healthy, unhealthy, stale;
  Service *s = svc(service_id);
  if (!out_view) {
    last_error = G_ERR_OUT;
    return 0;
  }
  std::memset(out_view, 0, sizeof(*out_view));
  if (!s)
    return 0;
  out_view->exists = 1;
  out_view->rollout_enabled = s->rollout[env_slot(environment_id)];
  out_view->blocked_direct = s->blocked;
  out_view->blocked_transitive =
      blocked_transitive(service_id, environment_id, ts);
  flags(service_id, environment_id, ts, &healthy, &unhealthy, &stale);
  out_view->attested = healthy;
  out_view->stale_attestation = stale;
  out_view->conflicting_evidence = healthy && unhealthy;
  out_view->waiver_active = waiver_active(service_id, environment_id, ts);
  out_view->admissible = admissible_inner(service_id, environment_id, ts);
  return 1;
}
extern "C" __attribute__((visibility("default"))) int
gate_count_admissible(int environment_id, int64_t ts) {
  int count = 0;
  for (int i = 0; i < G_MAX_SERVICES; i++)
    if (services[i].used &&
        gate_check_admission(services[i].id, environment_id, ts))
      count++;
  return count;
}
extern "C" __attribute__((visibility("default"))) int gate_last_error(void) {
  return last_error;
}
