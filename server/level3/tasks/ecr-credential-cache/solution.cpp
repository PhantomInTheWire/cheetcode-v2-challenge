#include <cstdint>
#include <cstring>

extern "C" {
typedef struct CredAuditView { int exists, registry_kind, cached, expired, client_error, token_id, refresh_count, usable; } CredAuditView;
}

enum { C_MAX = 256, C_DUP = 1, C_UNKNOWN = 2, C_OUT = 3, C_BAD_KIND = 4, C_CAP = 5 };
struct Reg { int used, id, kind, token, error, refresh_count; int64_t expiry; };
static Reg regs[C_MAX];
static int last_error = 0;
static Reg* regg(int id) { for (int i = 0; i < C_MAX; i++) if (regs[i].used && regs[i].id == id) return &regs[i]; return nullptr; }
static int usable_kind(int kind) { return kind == 1 || kind == 2; }
static int next_refresh_token(const Reg* reg) { int base = reg->kind == 1 ? 10000 : 20000; return reg->token > 0 ? reg->token + 1 : base + reg->refresh_count + 1; }
extern "C" __attribute__((visibility("default"))) void cred_reset(void) { std::memset(regs, 0, sizeof(regs)); last_error = 0; }
extern "C" __attribute__((visibility("default"))) int cred_set_registry_kind(int id, int kind) { Reg* reg = regg(id); if (!usable_kind(kind)) { last_error = C_BAD_KIND; return 0; } if (reg) { reg->kind = kind; last_error = 0; return 1; } for (int i = 0; i < C_MAX; i++) if (!regs[i].used) { regs[i] = {1, id, kind, 0, 0, 0, 0}; last_error = 0; return 1; } last_error = C_CAP; return 0; }
extern "C" __attribute__((visibility("default"))) int cred_inject_token(int id, int token, int64_t exp) { Reg* reg = regg(id); if (!reg) { last_error = C_UNKNOWN; return 0; } reg->token = token; reg->expiry = exp; last_error = 0; return 1; }
extern "C" __attribute__((visibility("default"))) int cred_get(int id, int64_t now) { Reg* reg = regg(id); if (!reg || !usable_kind(reg->kind)) { last_error = C_UNKNOWN; return 0; } if (reg->token && now < reg->expiry) { last_error = 0; return reg->token; } if (reg->error) { last_error = reg->error; return 0; } reg->token = next_refresh_token(reg); reg->expiry = now + (reg->kind == 1 ? 45 : 60); reg->refresh_count++; last_error = 0; return reg->token; }
extern "C" __attribute__((visibility("default"))) int cred_force_expire(int id) { Reg* reg = regg(id); if (!reg) { last_error = C_UNKNOWN; return 0; } reg->expiry = 0; last_error = 0; return 1; }
extern "C" __attribute__((visibility("default"))) int cred_set_client_error(int id, int error) { Reg* reg = regg(id); if (!reg) { last_error = C_UNKNOWN; return 0; } reg->error = error; last_error = 0; return 1; }
extern "C" __attribute__((visibility("default"))) int cred_audit_get(int id, int64_t now, CredAuditView* out) { Reg* reg = regg(id); if (!out) { last_error = C_OUT; return 0; } std::memset(out, 0, sizeof(*out)); if (!reg) return 0; out->exists = 1; out->registry_kind = reg->kind; out->cached = reg->token ? 1 : 0; out->expired = (reg->token && now >= reg->expiry) ? 1 : 0; out->client_error = reg->error; out->token_id = reg->token; out->refresh_count = reg->refresh_count; out->usable = (reg->token && now < reg->expiry && !reg->error && usable_kind(reg->kind)) ? 1 : 0; last_error = 0; return 1; }
extern "C" __attribute__((visibility("default"))) int cred_count_cached(int64_t now) { int count = 0; for (int i = 0; i < C_MAX; i++) if (regs[i].used && regs[i].token && now < regs[i].expiry && !regs[i].error && usable_kind(regs[i].kind)) count++; return count; }
extern "C" __attribute__((visibility("default"))) int cred_last_error(void) { return last_error; }
