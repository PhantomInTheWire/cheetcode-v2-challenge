"use client";

import { CLIENT_FINGERPRINT_HEADER } from "@/lib/fingerprint/fingerprint-contract";

const FP_STORAGE_KEY = "ctf:fp:visitor-id";
let fallbackFingerprintValue: string | null = null;
let fpPromise: Promise<{
  fingerprintId: string;
  fingerprintSource: "fingerprintjs" | "fallback";
}> | null = null;

function safeReadStoredFingerprint(): string | null {
  try {
    return window.localStorage.getItem(FP_STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeWriteStoredFingerprint(value: string): void {
  try {
    window.localStorage.setItem(FP_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures (private mode, strict settings, quota issues).
  }
}

function fallbackFingerprint(): string {
  if (fallbackFingerprintValue) return fallbackFingerprintValue;
  const existing = safeReadStoredFingerprint();
  if (existing) {
    fallbackFingerprintValue = existing;
    return existing;
  }
  const generated = `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  fallbackFingerprintValue = generated;
  safeWriteStoredFingerprint(generated);
  return generated;
}

function getStoredFingerprintState(): {
  fingerprintId: string;
  fingerprintSource: "fingerprintjs" | "fallback";
} | null {
  const fingerprintId = safeReadStoredFingerprint();
  if (!fingerprintId) return null;
  return {
    fingerprintId,
    fingerprintSource: fingerprintId.startsWith("fallback-")
      ? ("fallback" as const)
      : ("fingerprintjs" as const),
  };
}

function ensureFingerprintFetch(): Promise<{
  fingerprintId: string;
  fingerprintSource: "fingerprintjs" | "fallback";
}> {
  if (!fpPromise) {
    fpPromise = (async (): Promise<{
      fingerprintId: string;
      fingerprintSource: "fingerprintjs" | "fallback";
    }> => {
      try {
        const { default: FingerprintJS } = await import("@fingerprintjs/fingerprintjs");
        const agent = await FingerprintJS.load();
        const { visitorId } = await agent.get();
        if (!visitorId) {
          return {
            fingerprintId: fallbackFingerprint(),
            fingerprintSource: "fallback",
          };
        }
        safeWriteStoredFingerprint(visitorId);
        return {
          fingerprintId: visitorId,
          fingerprintSource: "fingerprintjs",
        };
      } catch {
        return {
          fingerprintId: fallbackFingerprint(),
          fingerprintSource: "fallback",
        };
      }
    })().finally(() => {
      fpPromise = null;
    });
  }
  return fpPromise;
}

export async function getClientFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server";
  return (await ensureFingerprintFetch()).fingerprintId;
}

export async function getClientFingerprintState(): Promise<{
  fingerprintId: string;
  fingerprintSource: "fingerprintjs" | "fallback";
}> {
  if (typeof window === "undefined") {
    return { fingerprintId: "server", fingerprintSource: "fallback" };
  }

  return getStoredFingerprintState() ?? (await ensureFingerprintFetch());
}

export async function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  if (typeof window === "undefined") {
    headers.set(CLIENT_FINGERPRINT_HEADER, "server");
  } else {
    const method = (init?.method ?? "GET").toUpperCase();
    const stored = getStoredFingerprintState();
    if (stored) {
      headers.set(CLIENT_FINGERPRINT_HEADER, stored.fingerprintId);
      void ensureFingerprintFetch();
    } else if (method !== "GET" && method !== "HEAD") {
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
