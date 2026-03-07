# Trait Expression AST

> **Goal**: Implement an expression evaluator and audit surface that preserves coherent behavior across nested transforms, constant expressions, matcher nodes, and namespace validation.

## Problem Description

The current trait-expression evaluator looks fine for isolated literals and simple variable lookups, but maintainers run into inconsistencies once nested transforms, constant expressions, and namespace validation interact. The result is a class of bugs where one call site can evaluate an expression, another rejects it, and audit output is too weak to explain whether the underlying problem is an invalid namespace, a boolean/string kind mismatch, or a child expression that failed inside a nested transform.

This task is intentionally shaped like a real parser/interpreter maintenance issue, not like a generic AST exercise. The difficult part is preserving coherent evaluation behavior across multiple node kinds and multiple caller expectations.

## Reproduction Shape

One realistic reproduction looks like this:

1. Register a trait value like an email address.
2. Compile a variable node referencing that trait.
3. Build nested expressions on top of it: `email.local(var)` and `replace(var, "example", "corp")`.
4. Compile a matcher over the transformed string.
5. Register another variable with an invalid namespace and confirm it fails evaluation while remaining visible to audit.
6. Keep a literal expression in the same graph and ensure it remains distinguishable from variable-driven expressions.

Maintainers do not want a parser that merely returns `0` on failure. They need enough audit state to tell whether the problem is in node kind, namespace validity, or a nested child that could not produce a string.

## Actual Behavior

- Simple expressions may evaluate while nested transforms still break or return inconsistent output ids.
- Invalid namespaces often fail too late and with poor diagnostics.
- Literal expressions are easy to accidentally treat like malformed variables or vice versa.
- Boolean matcher nodes can work in one call path while still being incorrectly treated as string-producing in another.

## Expected Behavior

- String-producing and boolean-producing nodes must remain distinguishable.
- Nested transforms must compose over already-compiled child expressions.
- Namespace validation must be explicit and audit-visible.
- Constant expressions must remain first-class instead of being conflated with variable-driven expressions.
- Audit output must let a maintainer tell whether an expression is constant, string-evaluable, match-evaluable, or blocked by namespace validation.

## AST Model

- Expressions are explicit nodes identified by `expr_id`.
- String-producing node kinds are literal, variable, email-local, and regex-replace.
- Boolean node kinds are regex-match with an optional negate flag.
- Nested expressions refer to already-compiled child expression ids.

## Validation Rules

- Variable namespaces are limited to `internal=1`, `external=2`, and `literal=3`.
- Any other namespace must be rejected at evaluation time and remain visible via `expr_audit_get`.
- Nested replace and email-local transforms must compose over valid string-producing child expressions.
- Boolean expressions are not valid inputs to `expr_evaluate_string`.
- Null output pointers must fail deterministically rather than being ignored.

## Matcher Rules

- `expr_evaluate_match` evaluates a compiled matcher node against the string produced by its child expression.
- `negate=1` inverts the boolean result.
- Match behavior is substring-style rather than full regex-engine fidelity; the important part is consistent composition and validation behavior.
- Audit for matcher nodes must preserve whether the last evaluated matcher result was truthy.

## Audit Contract

- `expr_audit_get` returns `1` for known expression ids and `0` otherwise.
- The audit payload must expose:
  - `exists`
  - `kind`
  - `string_evaluable`
  - `match_evaluable`
  - `constant_expr`
  - `namespace_error`
  - `matched`
  - `output_string_id`
- Audit must let a maintainer distinguish "invalid variable", "valid constant", and "boolean expression that matched".
- Known expressions with failed nested evaluation should still return audit state for the expression itself.

## Interface

Your submission must provide the following exported functions and C-compatible struct:

```c
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

void expr_reset(void);
int expr_register_string(int string_id, const char* value);
int expr_register_var(int var_id, int namespace_kind, int string_id);
int expr_compile_literal(int expr_id, int string_id);
int expr_compile_var(int expr_id, int var_id);
int expr_compile_email_local(int expr_id, int child_expr_id);
int expr_compile_regex_replace(int expr_id, int input_expr_id, int pattern_string_id, int replacement_string_id);
int expr_compile_regex_match(int expr_id, int input_expr_id, int pattern_string_id, int negate);
int expr_evaluate_string(int expr_id, int* out_string_id);
int expr_evaluate_match(int expr_id, int matcher_string_id);
int expr_audit_get(int expr_id, int matcher_string_id, ExprAuditView* out_view);
int expr_last_error(void);
```

## Error Reporting

- Duplicate ids, unknown expression ids, invalid node-kind usage, and null output pointers must produce stable differentiated errors.
- Unknown audit targets should return `0` without fabricating partial state.

## Scale Expectations

- Hidden validation includes repeated nested evaluation, many irrelevant strings and variables, repeated matcher reads over the same expression graph, and mixes of valid constant expressions with invalid variable expressions.
- Passing requires consistent validation and composition behavior across several interacting node kinds, not just one-off literal evaluation.
