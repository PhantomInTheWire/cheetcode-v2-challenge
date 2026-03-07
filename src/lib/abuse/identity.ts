import { isIP } from "is-ip";
import { TRUSTED_FINGERPRINT_HEADER } from "../fingerprint/fingerprint-contract";
export { TRUSTED_FINGERPRINT_HEADER };

const DEFAULT_IDENTITY = "anon";

function hashIdentity(raw: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ 0x9e3779b9;
    h2 = Math.imul(h2, 0x01000193);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${a}${b}`;
}

function normalizeIpCandidate(raw: string): string | null {
  const trimmed = raw.trim().replace(/^"|"$/g, "");
  if (!trimmed) return null;

  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    const end = trimmed.indexOf("]");
    return trimmed.slice(1, end);
  }

  const maybeIpv4Port = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (maybeIpv4Port?.[1]) return maybeIpv4Port[1];

  return trimmed;
}

function pickValidIp(candidates: string[]): string | null {
  for (const candidate of candidates) {
    const normalized = normalizeIpCandidate(candidate);
    if (!normalized) continue;
    if (isIP(normalized)) return normalized;
  }
  return null;
}

function extractIpAddress(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const chain = xff
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const trustedIp = pickValidIp(chain);
    if (trustedIp) return trustedIp;
  }

  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) {
    const trustedIp = pickValidIp([cfIp]);
    if (trustedIp) return trustedIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    const trustedIp = pickValidIp([realIp]);
    if (trustedIp) return trustedIp;
  }

  return DEFAULT_IDENTITY;
}

export function getIdentityKeys(request: Request): string[] {
  const ip = extractIpAddress(request);
  const fingerprint = request.headers.get(TRUSTED_FINGERPRINT_HEADER)?.trim() || DEFAULT_IDENTITY;

  const keys = new Set<string>();
  keys.add(`ip:${hashIdentity(ip)}`);
  if (fingerprint !== DEFAULT_IDENTITY) {
    keys.add(`fp:${hashIdentity(fingerprint)}`);
  }
  return [...keys];
}

export type IdentityDescriptor = {
  key: string;
  kind: "ip" | "fp";
};

export function getIdentityDescriptors(request: Request): IdentityDescriptor[] {
  return getIdentityKeys(request)
    .map((key) => {
      const [kind] = key.split(":", 1);
      if (kind !== "ip" && kind !== "fp") return null;
      return { key, kind };
    })
    .filter((entry): entry is IdentityDescriptor => entry !== null);
}
