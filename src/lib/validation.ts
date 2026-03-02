/**
 * Shared input validation — used client-side for instant feedback
 * and server-side to enforce constraints.
 */

// ── GitHub handle ──────────────────────────────────────────
const GITHUB_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const GITHUB_MAX = 39;

export function validateGithub(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: false, error: "GitHub username is required" };
  if (v.length > GITHUB_MAX) return { ok: false, error: `Max ${GITHUB_MAX} characters` };
  if (!GITHUB_RE.test(v))
    return { ok: false, error: "Invalid GitHub username — letters, numbers, and hyphens only" };
  return { ok: true, value: v };
}

// ── Email ──────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;

export function validateEmail(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const v = raw.trim().toLowerCase();
  if (!v) return { ok: false, error: "Email is required" };
  if (v.length > EMAIL_MAX) return { ok: false, error: "Email too long" };
  if (!EMAIL_RE.test(v)) return { ok: false, error: "Invalid email address" };
  return { ok: true, value: v };
}

// ── X / Twitter handle (optional) ──────────────────────────
const X_HANDLE_RE = /^@?[a-zA-Z0-9_]{1,15}$/;

export function validateXHandle(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const v = raw.trim();
  if (!v) return { ok: true, value: "" }; // optional
  if (!X_HANDLE_RE.test(v)) return { ok: false, error: "Invalid X handle" };
  // Normalize: strip leading @ if present
  return { ok: true, value: v.startsWith("@") ? v.slice(1) : v };
}

// ── Code submission ────────────────────────────────────────
const CODE_MAX_BYTES = 10_000; // 10 KB per problem — generous but prevents abuse

export function validateCode(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (new TextEncoder().encode(raw).length > CODE_MAX_BYTES) {
    return { ok: false, error: "Code exceeds 10 KB limit" };
  }
  return { ok: true, value: raw };
}
