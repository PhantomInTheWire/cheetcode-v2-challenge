"use client";

import { CLIENT_FINGERPRINT_HEADER } from "@/lib/fingerprint/fingerprint-contract";

const FP_STORAGE_KEY = "ctf:fp:visitor-id";
let fpPromise: Promise<string> | null = null;
let inMemoryFingerprint: string | null = null;
let fingerprintSource: "fingerprintjs" | "fallback" = "fallback";

function safeReadStoredFingerprint(): string | null {
  if (inMemoryFingerprint) return inMemoryFingerprint;
  try {
    const stored = window.localStorage.getItem(FP_STORAGE_KEY);
    if (stored) inMemoryFingerprint = stored;
    return stored;
  } catch {
    return null;
  }
}

function safeWriteStoredFingerprint(value: string): void {
  inMemoryFingerprint = value;
  try {
    window.localStorage.setItem(FP_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures (private mode, strict settings, quota issues).
  }
}

function fallbackFingerprint(): string {
  const existing = safeReadStoredFingerprint();
  if (existing) return existing;
  const generated = `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  safeWriteStoredFingerprint(generated);
  fingerprintSource = "fallback";
  return generated;
}

function ensureFingerprintFetch(): Promise<string> {
  if (!fpPromise) {
    fpPromise = (async () => {
      try {
        const { default: FingerprintJS } = await import("@fingerprintjs/fingerprintjs");
        const agent = await FingerprintJS.load();
        const { visitorId } = await agent.get();
        if (!visitorId) return fallbackFingerprint();
        safeWriteStoredFingerprint(visitorId);
        fingerprintSource = "fingerprintjs";
        return visitorId;
      } catch {
        return fallbackFingerprint();
      }
    })();
  }
  return fpPromise;
}

export async function getClientFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server";
  return ensureFingerprintFetch();
}

export async function getClientFingerprintState(): Promise<{
  fingerprintId: string;
  fingerprintSource: "fingerprintjs" | "fallback";
}> {
  if (typeof window === "undefined") {
    return { fingerprintId: "server", fingerprintSource: "fallback" };
  }

  const fingerprintId = await ensureFingerprintFetch();
  return { fingerprintId, fingerprintSource };
}

export async function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  if (typeof window === "undefined") {
    headers.set(CLIENT_FINGERPRINT_HEADER, "server");
  } else {
    const method = (init?.method ?? "GET").toUpperCase();
    const isMutation = method !== "GET" && method !== "HEAD";
    const stored = safeReadStoredFingerprint();
    if (stored) {
      headers.set(CLIENT_FINGERPRINT_HEADER, stored);
      void ensureFingerprintFetch();
    } else if (isMutation) {
      headers.set(CLIENT_FINGERPRINT_HEADER, fallbackFingerprint());
      void ensureFingerprintFetch();
    } else {
      headers.set(CLIENT_FINGERPRINT_HEADER, fallbackFingerprint());
      void ensureFingerprintFetch();
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
