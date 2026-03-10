#include <cstdint>
#include <cstring>

extern "C" {
typedef struct ResolverAuditView {
  int exists;
  int resolved;
  int redirected;
  int synthesized_init;
  int deprecated_redirect;
  int tombstoned;
  int ambiguous_import;
  int included_in_payload;
} ResolverAuditView;
}

enum { R_MAX = 256, R_OK = 0, R_DUP = 1, R_UNKNOWN = 2, R_OUT = 3, R_CAP = 4 };
struct Module { int used, id, parent, is_package, has_init; };
struct Import { int used, owner, target, ambiguous; };
struct Redirect { int used, from, to, deprecated, tombstoned; };
struct PayloadState {
  int used;
  int root_id;
  int direct_ids[R_MAX];
  int direct_count;
  int synth_ids[R_MAX];
  int synth_count;
};

static Module mods[R_MAX];
static Import imps[R_MAX];
static Redirect reds[R_MAX];
static PayloadState payloads[R_MAX];
static int last_error = 0;

static Module* mod_by_id(int id) { for (int i = 0; i < R_MAX; i++) if (mods[i].used && mods[i].id == id) return &mods[i]; return nullptr; }
static int mod_index_by_id(int id) { for (int i = 0; i < R_MAX; i++) if (mods[i].used && mods[i].id == id) return i; return -1; }
static Redirect* redirect_by_from(int id) { for (int i = 0; i < R_MAX; i++) if (reds[i].used && reds[i].from == id) return &reds[i]; return nullptr; }
static int contains_id(const int* values, int count, int id) { for (int i = 0; i < count; i++) if (values[i] == id) return 1; return 0; }
static int append_unique(int* values, int* count, int id) { if (contains_id(values, *count, id)) return 1; if (*count >= R_MAX) return 0; values[(*count)++] = id; return 1; }
static PayloadState* payload_for_root(int root_id, int create) {
  for (int i = 0; i < R_MAX; i++) if (payloads[i].used && payloads[i].root_id == root_id) return &payloads[i];
  if (!create) return nullptr;
  for (int i = 0; i < R_MAX; i++) if (!payloads[i].used) { std::memset(&payloads[i], 0, sizeof(payloads[i])); payloads[i].used = 1; payloads[i].root_id = root_id; return &payloads[i]; }
  return nullptr;
}
static void clear_payload(PayloadState* payload) { payload->direct_count = 0; payload->synth_count = 0; }
static int payload_contains(const PayloadState* payload, int module_id) { return contains_id(payload->direct_ids, payload->direct_count, module_id) || contains_id(payload->synth_ids, payload->synth_count, module_id); }
static int add_direct(PayloadState* payload, int module_id) { return append_unique(payload->direct_ids, &payload->direct_count, module_id); }
static int add_synth(PayloadState* payload, int module_id) { return append_unique(payload->synth_ids, &payload->synth_count, module_id); }
static int resolve_target(int target, int* redirected, int* deprecated, int* tombstoned) {
  int hop_guard = 0;
  *redirected = *deprecated = *tombstoned = 0;
  while (hop_guard++ < R_MAX) {
    Redirect* red = redirect_by_from(target);
    if (!red) return target;
    *redirected = 1;
    if (red->deprecated) *deprecated = 1;
    if (red->tombstoned) { *tombstoned = 1; return -1; }
    target = red->to;
  }
  *tombstoned = 1;
  return -1;
}
static int add_package_chain(PayloadState* payload, int module_id) {
  Module* current = mod_by_id(module_id);
  while (current && current->parent >= 0) {
    current = mod_by_id(current->parent);
    if (!current) break;
    if (current->is_package && !current->has_init) {
      if (!add_synth(payload, current->id)) return 0;
    }
  }
  return 1;
}

extern "C" __attribute__((visibility("default"))) void resolver_reset(void) { std::memset(mods, 0, sizeof(mods)); std::memset(imps, 0, sizeof(imps)); std::memset(reds, 0, sizeof(reds)); std::memset(payloads, 0, sizeof(payloads)); last_error = 0; }
extern "C" __attribute__((visibility("default"))) int resolver_add_module(int module_id, int parent_module_id, int is_package, int has_init) { if (mod_by_id(module_id)) { last_error = R_DUP; return 0; } for (int i = 0; i < R_MAX; i++) if (!mods[i].used) { mods[i] = {1, module_id, parent_module_id, is_package ? 1 : 0, has_init ? 1 : 0}; last_error = 0; return 1; } last_error = R_CAP; return 0; }
extern "C" __attribute__((visibility("default"))) int resolver_add_import(int owner, int target, int ambiguous) { if (!mod_by_id(owner)) { last_error = R_UNKNOWN; return 0; } for (int i = 0; i < R_MAX; i++) if (!imps[i].used) { imps[i] = {1, owner, target, ambiguous ? 1 : 0}; last_error = 0; return 1; } last_error = R_CAP; return 0; }
extern "C" __attribute__((visibility("default"))) int resolver_add_redirect(int from, int to, int deprecated, int tombstoned) { if (redirect_by_from(from)) { last_error = R_DUP; return 0; } for (int i = 0; i < R_MAX; i++) if (!reds[i].used) { reds[i] = {1, from, to, deprecated ? 1 : 0, tombstoned ? 1 : 0}; last_error = 0; return 1; } last_error = R_CAP; return 0; }
extern "C" __attribute__((visibility("default"))) int resolver_build_payload(int root) { int queue[R_MAX], qh = 0, qt = 0, seen[R_MAX]; PayloadState* payload = payload_for_root(root, 1); if (!mod_by_id(root) || !payload) { last_error = payload ? R_UNKNOWN : R_CAP; return 0; } std::memset(seen, 0, sizeof(seen)); clear_payload(payload); queue[qt++] = root; while (qh < qt) { int cur = queue[qh++]; int cur_index = mod_index_by_id(cur); if (cur_index < 0 || seen[cur_index]) continue; seen[cur_index] = 1; if (!add_direct(payload, cur) || !add_package_chain(payload, cur)) { last_error = R_CAP; return 0; } for (int i = 0; i < R_MAX; i++) { int redirected = 0, deprecated = 0, tombstoned = 0; int target; if (!imps[i].used || imps[i].owner != cur) continue; target = resolve_target(imps[i].target, &redirected, &deprecated, &tombstoned); if (target < 0) continue; if (mod_by_id(target) && qt < R_MAX) queue[qt++] = target; } } last_error = 0; return 1; }
extern "C" __attribute__((visibility("default"))) int resolver_payload_contains(int root, int module_id) { PayloadState* payload = payload_for_root(root, 0); if (!payload) return 0; return payload_contains(payload, module_id); }
extern "C" __attribute__((visibility("default"))) int resolver_audit_get(int root, int module_id, ResolverAuditView* out) { int redirected = 0, deprecated = 0, tombstoned = 0; int resolved_target; PayloadState* payload = payload_for_root(root, 0); if (!out) { last_error = R_OUT; return 0; } std::memset(out, 0, sizeof(*out)); if (!mod_by_id(module_id) && !redirect_by_from(module_id)) return 0; resolved_target = resolve_target(module_id, &redirected, &deprecated, &tombstoned); out->exists = 1; out->redirected = redirected; out->deprecated_redirect = deprecated; out->tombstoned = tombstoned; out->resolved = resolved_target >= 0 ? 1 : 0; out->synthesized_init = payload ? contains_id(payload->synth_ids, payload->synth_count, module_id) : 0; out->included_in_payload = payload ? payload_contains(payload, module_id) : 0; for (int i = 0; i < R_MAX; i++) if (imps[i].used && imps[i].target == module_id && imps[i].ambiguous) { out->ambiguous_import = 1; break; } last_error = 0; return 1; }
extern "C" __attribute__((visibility("default"))) int resolver_count_payload_modules(int root) { PayloadState* payload = payload_for_root(root, 0); if (!payload) return 0; return payload->direct_count + payload->synth_count; }
extern "C" __attribute__((visibility("default"))) int resolver_last_error(void) { return last_error; }
