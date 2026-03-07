extern "C" {
#include <stdint.h>
#include <string.h>
enum {
  S_MAX_SESSIONS = 512,
  S_MAX_CREDS = 2048,
  S_OK = 0,
  S_ERR_DUP = 1,
  S_ERR_UNKNOWN = 2,
  S_ERR_OUT = 3
};
typedef struct SessionAuditView {
  int exists, session_revoked, active_generation, staged_generation,
      presented_generation, grace_generation, grace_active, generation_revoked,
      compatible, usable;
} SessionAuditView;
typedef struct {
  int used, id, subject_id, resource_id, active_generation, staged_generation,
      grace_generation, revoked, rev_gens[S_MAX_CREDS];
  int64_t grace_until_ts;
} Session;
typedef struct {
  int used, id, session_id, generation;
  int64_t issued_ts, expires_ts;
} Credential;
static Session sessions[S_MAX_SESSIONS];
static Credential creds[S_MAX_CREDS];
static int last_error = 0;
static Session *session_by_id(int id) {
  for (int i = 0; i < S_MAX_SESSIONS; i++)
    if (sessions[i].used && sessions[i].id == id)
      return &sessions[i];
  return 0;
}
static int gen_revoked(Session *s, int generation) {
  for (int i = 0; i < 8; i++)
    if (s->rev_gens[i] == generation)
      return 1;
  return 0;
}
static Credential *latest_cred(int session_id, int generation, int64_t ts) {
  Credential *best = 0;
  for (int i = 0; i < S_MAX_CREDS; i++) {
    Credential *c = &creds[i];
    if (!c->used || c->session_id != session_id ||
        c->generation != generation || ts >= c->expires_ts)
      continue;
    if (!best || c->issued_ts > best->issued_ts)
      best = c;
  }
  return best;
}
__attribute__((visibility("default"))) void session_reset(void) {
  memset(sessions, 0, sizeof(sessions));
  memset(creds, 0, sizeof(creds));
  last_error = S_OK;
}
__attribute__((visibility("default"))) int
session_create(int session_id, int subject_id, int resource_id,
               int active_generation) {
  if (session_by_id(session_id)) {
    last_error = S_ERR_DUP;
    return 0;
  }
  for (int i = 0; i < S_MAX_SESSIONS; i++)
    if (!sessions[i].used) {
      sessions[i].used = 1;
      sessions[i].id = session_id;
      sessions[i].subject_id = subject_id;
      sessions[i].resource_id = resource_id;
      sessions[i].active_generation = active_generation;
      last_error = S_OK;
      return 1;
    }
  return 0;
}
__attribute__((visibility("default"))) int
session_issue_credential(int credential_id, int session_id, int generation,
                         int64_t issued_ts, int64_t expires_ts) {
  for (int i = 0; i < S_MAX_CREDS; i++)
    if (creds[i].used && creds[i].id == credential_id) {
      last_error = S_ERR_DUP;
      return 0;
    }
  if (!session_by_id(session_id)) {
    last_error = S_ERR_UNKNOWN;
    return 0;
  }
  for (int i = 0; i < S_MAX_CREDS; i++)
    if (!creds[i].used) {
      creds[i].used = 1;
      creds[i].id = credential_id;
      creds[i].session_id = session_id;
      creds[i].generation = generation;
      creds[i].issued_ts = issued_ts;
      creds[i].expires_ts = expires_ts;
      return 1;
    }
  return 0;
}
__attribute__((visibility("default"))) int
session_stage_generation(int session_id, int generation,
                         int64_t grace_until_ts) {
  Session *s = session_by_id(session_id);
  if (!s) {
    last_error = S_ERR_UNKNOWN;
    return 0;
  }
  s->staged_generation = generation;
  s->grace_until_ts = grace_until_ts;
  return 1;
}
__attribute__((visibility("default"))) int
session_activate_generation(int session_id, int64_t ts) {
  Session *s = session_by_id(session_id);
  (void)ts;
  if (!s || s->staged_generation == 0) {
    last_error = S_ERR_UNKNOWN;
    return 0;
  }
  s->grace_generation = s->active_generation;
  s->active_generation = s->staged_generation;
  s->staged_generation = 0;
  return 1;
}
__attribute__((visibility("default"))) int session_revoke(int session_id,
                                                          int generation) {
  Session *s = session_by_id(session_id);
  if (!s) {
    last_error = S_ERR_UNKNOWN;
    return 0;
  }
  if (generation < 0)
    s->revoked = 1;
  else
    for (int i = 0; i < S_MAX_CREDS; i++)
      if (s->rev_gens[i] == generation)
        break;
      else if (s->rev_gens[i] == 0) {
        s->rev_gens[i] = generation;
        break;
      }
  return 1;
}
__attribute__((visibility("default"))) int
session_check(int session_id, int generation, int64_t ts) {
  Session *s = session_by_id(session_id);
  Credential *c;
  if (!s || s->revoked || gen_revoked(s, generation))
    return 0;
  c = latest_cred(session_id, generation, ts);
  if (!c)
    return 0;
  if (generation == s->active_generation)
    return 1;
  if (generation == s->grace_generation && ts < s->grace_until_ts)
    return 1;
  return 0;
}
__attribute__((visibility("default"))) int
session_audit_get(int session_id, int generation, int64_t ts,
                  SessionAuditView *out_view) {
  Session *s = session_by_id(session_id);
  if (!out_view) {
    last_error = S_ERR_OUT;
    return 0;
  }
  memset(out_view, 0, sizeof(*out_view));
  if (!s) {
    last_error = S_ERR_UNKNOWN;
    return 0;
  }
  out_view->exists = 1;
  out_view->session_revoked = s->revoked;
  out_view->active_generation = s->active_generation;
  out_view->staged_generation = s->staged_generation;
  out_view->presented_generation = generation;
  out_view->grace_generation = s->grace_generation;
  out_view->grace_active =
      (generation == s->grace_generation && ts < s->grace_until_ts) ? 1 : 0;
  out_view->generation_revoked = gen_revoked(s, generation);
  out_view->compatible =
      out_view->grace_active || generation == s->active_generation;
  out_view->usable = session_check(session_id, generation, ts);
  last_error = S_OK;
  return 1;
}
__attribute__((visibility("default"))) int session_count_active(int subject_id,
                                                                int64_t ts) {
  int count = 0;
  for (int i = 0; i < S_MAX_SESSIONS; i++)
    if (sessions[i].used && sessions[i].subject_id == subject_id &&
        !sessions[i].revoked &&
        session_check(sessions[i].id, sessions[i].active_generation, ts))
      count++;
  return count;
}
__attribute__((visibility("default"))) int session_last_error(void) {
  return last_error;
}
}
