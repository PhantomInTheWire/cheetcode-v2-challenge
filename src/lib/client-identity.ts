"use client";

declare global {
  interface Window {
    FingerprintJS?: {
      load: () => Promise<{
        get: () => Promise<{ visitorId: string }>;
      }>;
    };
  }
}

const FP_STORAGE_KEY = "ctf:fp:visitor-id";
let fpPromise: Promise<string> | null = null;

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
  const existing = safeReadStoredFingerprint();
  if (existing) return existing;
  const generated = `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  safeWriteStoredFingerprint(generated);
  return generated;
}

export async function getClientFingerprint(): Promise<string> {
  if (typeof window === "undefined") return "server";
  if (!fpPromise) {
    fpPromise = (async () => {
      try {
        const fpjs = window.FingerprintJS;
        if (!fpjs) return fallbackFingerprint();
        const agent = await fpjs.load();
        const { visitorId } = await agent.get();
        if (!visitorId) return fallbackFingerprint();
        safeWriteStoredFingerprint(visitorId);
        return visitorId;
      } catch {
        return fallbackFingerprint();
      }
    })();
  }
  return fpPromise;
}

export async function clientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const fingerprint = await getClientFingerprint();
  const headers = new Headers(init?.headers ?? {});
  headers.set("x-client-fingerprint", fingerprint);

  return fetch(input, {
    ...init,
    headers,
  });
}
