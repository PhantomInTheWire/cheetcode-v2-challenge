#include <stdint.h>
#include <stdio.h>
#include <string.h>

enum {
  E_MAX = 256,
  E_DUP = 1,
  E_UNKNOWN = 2,
  E_OUT = 3,
  E_BAD_NS = 4,
  E_BAD_KIND = 5,
  E_DEPTH = 6
};
enum { K_LIT = 1, K_VAR = 2, K_EMAIL = 3, K_REPL = 4, K_MATCH = 5 };

typedef struct ExprAuditView {
  int exists;
  int kind;
  int string_evaluable;
  int match_evaluable;
  int constant_expr;
  int namespace_error;
  int matched;
  int output_string_id;
} ExprAuditView;

typedef struct {
  int used, id, ns, val_id;
} Var;
typedef struct {
  int used, id;
  char v[128];
} Str;
typedef struct {
  int used, id, kind, a, b, c;
} Expr;

static Var vars[E_MAX];
static Str strs[E_MAX];
static Expr exprs[E_MAX];
static int last_error = 0;
static int next_id = 1000;

static Str *strf(int id) {
  for (int i = 0; i < E_MAX; i++)
    if (strs[i].used && strs[i].id == id)
      return &strs[i];
  return 0;
}

static Var *varf(int id) {
  for (int i = 0; i < E_MAX; i++)
    if (vars[i].used && vars[i].id == id)
      return &vars[i];
  return 0;
}

static Expr *exprf(int id) {
  for (int i = 0; i < E_MAX; i++)
    if (exprs[i].used && exprs[i].id == id)
      return &exprs[i];
  return 0;
}

static int intern(const char *s) {
  for (int i = 0; i < E_MAX; i++) {
    if (strs[i].used && strcmp(strs[i].v, s) == 0)
      return strs[i].id;
  }
  for (int i = 0; i < E_MAX; i++) {
    if (!strs[i].used) {
      strs[i].used = 1;
      strs[i].id = next_id++;
      snprintf(strs[i].v, sizeof(strs[i].v), "%s", s);
      return strs[i].id;
    }
  }
  return 0;
}

static int eval_string_id_depth(int expr_id, int depth);

static int eval_string_id_depth(int expr_id, int depth) {
  char buf[128];
  Expr *expr = exprf(expr_id);
  if (!expr) {
    last_error = E_UNKNOWN;
    return 0;
  }
  if (depth > 32) {
    last_error = E_DEPTH;
    return 0;
  }
  if (expr->kind == K_LIT) {
    return expr->a;
  }
  if (expr->kind == K_VAR) {
    Var *var = varf(expr->a);
    if (!var || var->ns < 1 || var->ns > 3) {
      last_error = E_BAD_NS;
      return 0;
    }
    return var->val_id;
  }
  if (expr->kind == K_EMAIL) {
    int sid = eval_string_id_depth(expr->a, depth + 1);
    Str *src = strf(sid);
    char *at;
    if (!src)
      return 0;
    snprintf(buf, sizeof(buf), "%s", src->v);
    at = strchr(buf, '@');
    if (at)
      *at = '\0';
    return intern(buf);
  }
  if (expr->kind == K_REPL) {
    int sid = eval_string_id_depth(expr->a, depth + 1);
    Str *src = strf(sid);
    Str *pat = strf(expr->b);
    Str *rep = strf(expr->c);
    char *pos;
    if (!src || !pat || !rep) {
      last_error = E_UNKNOWN;
      return 0;
    }
    snprintf(buf, sizeof(buf), "%s", src->v);
    pos = strstr(buf, pat->v);
    if (pos) {
      char out[128];
      *pos = '\0';
      snprintf(out, sizeof(out), "%s%s%s", buf, rep->v, pos + strlen(pat->v));
      return intern(out);
    }
    return intern(buf);
  }
  last_error = E_BAD_KIND;
  return 0;
}

static int eval_match_value(int expr_id, int matcher_sid) {
  Expr *expr = exprf(expr_id);
  Str *val;
  Str *pat;
  int sid;
  if (!expr || expr->kind != K_MATCH) {
    last_error = E_BAD_KIND;
    return 0;
  }
  sid = expr->a ? eval_string_id_depth(expr->a, 0) : matcher_sid;
  val = strf(sid);
  pat = strf(expr->b);
  if (!val || !pat) {
    last_error = E_UNKNOWN;
    return 0;
  }
  last_error = 0;
  return (strstr(val->v, pat->v) != 0) ^ (expr->c ? 1 : 0);
}

__attribute__((visibility("default"))) void expr_reset(void) {
  memset(vars, 0, sizeof(vars));
  memset(strs, 0, sizeof(strs));
  memset(exprs, 0, sizeof(exprs));
  last_error = 0;
  next_id = 1000;
}

__attribute__((visibility("default"))) int
expr_register_string(int id, const char *value) {
  if (strf(id)) {
    last_error = E_DUP;
    return 0;
  }
  for (int i = 0; i < E_MAX; i++) {
    if (!strs[i].used) {
      strs[i].used = 1;
      strs[i].id = id;
      snprintf(strs[i].v, sizeof(strs[i].v), "%s", value ? value : "");
      last_error = 0;
      return 1;
    }
  }
  return 0;
}

__attribute__((visibility("default"))) int expr_register_var(int id, int ns,
                                                             int sid) {
  if (varf(id)) {
    last_error = E_DUP;
    return 0;
  }
  for (int i = 0; i < E_MAX; i++) {
    if (!vars[i].used) {
      vars[i] = (Var){1, id, ns, sid};
      last_error = 0;
      return 1;
    }
  }
  return 0;
}

static int add_expr(int id, int kind, int a, int b, int c) {
  if (exprf(id)) {
    last_error = E_DUP;
    return 0;
  }
  for (int i = 0; i < E_MAX; i++) {
    if (!exprs[i].used) {
      exprs[i] = (Expr){1, id, kind, a, b, c};
      last_error = 0;
      return 1;
    }
  }
  return 0;
}

__attribute__((visibility("default"))) int expr_compile_literal(int id,
                                                                int sid) {
  return add_expr(id, K_LIT, sid, 0, 0);
}
__attribute__((visibility("default"))) int expr_compile_var(int id, int vid) {
  return add_expr(id, K_VAR, vid, 0, 0);
}
__attribute__((visibility("default"))) int expr_compile_email_local(int id,
                                                                    int child) {
  return add_expr(id, K_EMAIL, child, 0, 0);
}
__attribute__((visibility("default"))) int
expr_compile_regex_replace(int id, int input, int pat, int rep) {
  return add_expr(id, K_REPL, input, pat, rep);
}
__attribute__((visibility("default"))) int
expr_compile_regex_match(int id, int input, int pat, int negate) {
  return add_expr(id, K_MATCH, input, pat, negate ? 1 : 0);
}

__attribute__((visibility("default"))) int expr_evaluate_string(int expr_id,
                                                                int *out) {
  int sid;
  Expr *expr = exprf(expr_id);
  if (!out) {
    last_error = E_OUT;
    return 0;
  }
  if (!expr || expr->kind == K_MATCH) {
    last_error = expr ? E_BAD_KIND : E_UNKNOWN;
    return 0;
  }
  sid = eval_string_id_depth(expr_id, 0);
  if (!sid)
    return 0;
  *out = sid;
  last_error = 0;
  return 1;
}

__attribute__((visibility("default"))) int
expr_evaluate_match(int expr_id, int matcher_sid) {
  return eval_match_value(expr_id, matcher_sid);
}

__attribute__((visibility("default"))) int
expr_audit_get(int expr_id, int matcher_sid, ExprAuditView *out) {
  Expr *expr = exprf(expr_id);
  if (!out) {
    last_error = E_OUT;
    return 0;
  }
  memset(out, 0, sizeof(*out));
  if (!expr)
    return 0;
  out->exists = 1;
  out->kind = expr->kind;
  out->string_evaluable = expr->kind != K_MATCH;
  out->match_evaluable = expr->kind == K_MATCH;
  out->constant_expr = expr->kind == K_LIT;
  if (expr->kind == K_VAR) {
    Var *var = varf(expr->a);
    out->namespace_error = (var && (var->ns < 1 || var->ns > 3)) ? 1 : 0;
  }
  if (out->string_evaluable) {
    out->output_string_id = eval_string_id_depth(expr_id, 0);
  }
  if (out->match_evaluable) {
    out->matched = eval_match_value(expr_id, matcher_sid);
  }
  return 1;
}

__attribute__((visibility("default"))) int expr_last_error(void) {
  return last_error;
}
