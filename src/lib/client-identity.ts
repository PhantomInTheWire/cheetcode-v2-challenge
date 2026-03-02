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

function fallbackFingerprint(): string {
  const existing = window.localStorage.getItem(FP_STORAGE_KEY);
  if (existing) return existing;
  const generated =
    `fallback-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(FP_STORAGE_KEY, generated);
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
        window.localStorage.setItem(FP_STORAGE_KEY, visitorId);
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
