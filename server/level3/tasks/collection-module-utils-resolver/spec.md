## Title

Collection `module_utils` payload builder drops redirected files, package shims, and ambiguous imports during rebuilds

## Problem Description

The current collection payload builder behaves correctly for the simplest `module_utils` imports, but it falls apart once the collection contains redirected utilities, namespace packages missing intermediate `__init__` files, and imports that are syntactically valid while being semantically ambiguous.

This task is modeled after the maintainer experience of debugging "payload is missing a file" reports where the real bug is not one missing edge. The failure only becomes obvious after looking at redirects, package ancestry, and rebuild behavior together.

## Reproduction Shape

One concrete reproduction looks like this:

1. A collection module imports a helper from `module_utils.pkg.util`.
2. That helper was moved and now resolves through a redirect entry.
3. The intermediate package exists logically but has no materialized `__init__`.
4. A second import in the same module is ambiguous because the imported name could refer either to a module or to an attribute re-exported from a package.
5. Rebuilding a payload for a different root after changing the graph should not leak the previous root's payload state.

Maintainers do not experience this as a neat graph problem. They see a payload that works for one module, fails for another, and gives poor clues about whether the missing thing was redirected, synthesized, skipped, or tombstoned.

## Actual Behavior

- Redirect sources are easy to resolve without preserving enough audit information about why the payload changed.
- Missing package ancestors are often omitted instead of being represented as synthesized empty `__init__` entries.
- Ambiguous imports are treated as ordinary imports even though operators need to see that ambiguity in audit output.
- Rebuilds can accidentally look correct for one root while leaking stale payload state from another root.
- Tombstoned redirects tend to disappear from results entirely instead of staying visible as a failed resolution state.

## Expected Behavior

- Payload construction must walk the reachable import closure for exactly one root module at a time.
- Redirected imports must contribute the resolved target while preserving audit visibility for the original imported id.
- Missing package ancestors must behave as synthesized package shims when needed for a valid payload layout.
- Tombstoned redirects must remain visible to audit callers even though they do not yield a usable payload target.
- Rebuilding a root must clear only that root's payload state and then rebuild from the current module/import/redirect graph.

Resolution Model

- Modules are identified by integer ids and form a rooted dependency graph.
- Each module records its parent package id, whether it is a package, and whether it already ships an `__init__`.
- Imports are declared on the owner module and may be marked ambiguous.
- Redirects remap one imported module id to another and may be deprecated or tombstoned.
- Redirect application happens on the imported module id, not on the importing owner.

Redirect Rules

- Deprecated redirects still resolve and must remain audit-visible on the original source id.
- Tombstoned redirects are resolution-visible but payload-negative: they do not contribute a usable target to the built payload.
- Redirect chains may exist; callers should get the final non-tombstoned target if one exists.
- Duplicate redirect sources are invalid and must fail deterministically.

Payload Assembly Rules

- `resolver_build_payload(root_module_id)` builds payload state for exactly that root.
- Reachable modules are included at most once per root payload even when referenced multiple times.
- If a reachable package ancestor has `has_init=0`, payload assembly must behave as if an empty `__init__` file was synthesized for that ancestor.
- `resolver_count_payload_modules` counts both directly included modules and synthesized package shims.
- Rebuilding a root payload must discard the prior payload contents for that root and recompute from current graph state.
- Building one root must not mutate the payload membership of another already-built root.

Audit Contract

- `resolver_audit_get` returns `1` for known module ids or redirect-source ids and `0` otherwise.
- The audit payload must expose:
  - `exists`
  - `resolved`
  - `redirected`
  - `synthesized_init`
  - `deprecated_redirect`
  - `tombstoned`
  - `ambiguous_import`
  - `included_in_payload`
- Audit is expected to explain "why this path behaved the way it did", not merely "was it in the payload".
- A null audit pointer must fail with a stable error rather than crashing or silently succeeding.

**Interface**: Your submission must provide the following exported functions and C-compatible struct:

```c
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

void resolver_reset(void);
int resolver_add_module(int module_id, int parent_module_id, int is_package, int has_init);
int resolver_add_import(int owner_module_id, int target_module_id, int ambiguous);
int resolver_add_redirect(int from_module_id, int to_module_id, int deprecated, int tombstoned);
int resolver_build_payload(int root_module_id);
int resolver_payload_contains(int root_module_id, int module_id);
int resolver_audit_get(int root_module_id, int module_id, ResolverAuditView* out_view);
int resolver_count_payload_modules(int root_module_id);
int resolver_last_error(void);
```

Error Reporting

- Duplicate module ids, duplicate redirect sources, unknown owner modules, unknown payload roots, and null audit pointers must produce stable differentiated errors.
- Unknown audit targets should return `0` without inventing partial state.

Scale Expectations

- Hidden validation includes large import graphs, repeated payload rebuilds, redirect chains, many irrelevant modules, and repeated audit reads over redirected, ambiguous, synthesized, and tombstoned paths.
- Passing requires behavior that remains correct when rebuild order changes and when most graph entries are unrelated noise.
