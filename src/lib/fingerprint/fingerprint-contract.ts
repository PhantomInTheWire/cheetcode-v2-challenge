export const FINGERPRINT_COOKIE = "ctf_fp";
export const CLIENT_FINGERPRINT_HEADER = "x-client-fingerprint";
export const TRUSTED_FINGERPRINT_HEADER = "x-ctf-fingerprint";

const CLIENT_FINGERPRINT_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function normalizeClientFingerprint(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return CLIENT_FINGERPRINT_PATTERN.test(trimmed) ? trimmed : "";
}

export function isFallbackFingerprint(value: string | undefined): boolean {
  return value?.startsWith("fallback-") ?? false;
}
