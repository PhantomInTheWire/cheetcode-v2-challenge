import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  fpLoadMock: vi.fn(async () => ({ get: vi.fn(async () => ({ visitorId: "fp-123" })) })),
}));

vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: {
    load: hoisted.fpLoadMock,
  },
}));

function mockWindow(overrides: Partial<Window> = {}) {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: vi.fn((k: string) => storage.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      storage.set(k, v);
    }),
  } as unknown as Storage;

  Object.defineProperty(globalThis, "window", {
    value: {
      localStorage,
      ...overrides,
    },
    configurable: true,
    writable: true,
  });

  return { localStorage, storage };
}

describe("client-identity", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.fpLoadMock.mockReset();
    hoisted.fpLoadMock.mockResolvedValue({
      get: vi.fn(async () => ({ visitorId: "fp-123" })),
    });
  });

  it("uses FingerprintJS visitorId when available", async () => {
    mockWindow();

    const mod = await import("../src/lib/client-identity");
    const fp = await mod.getClientFingerprint();
    expect(fp).toBe("fp-123");
  });

  it("falls back and survives localStorage errors", async () => {
    const badStorage = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      }),
      setItem: vi.fn(() => {
        throw new Error("denied");
      }),
    } as unknown as Storage;

    Object.defineProperty(globalThis, "window", {
      value: { localStorage: badStorage },
      configurable: true,
      writable: true,
    });
    hoisted.fpLoadMock.mockRejectedValueOnce(new Error("fp unavailable"));

    const mod = await import("../src/lib/client-identity");
    const fp = await mod.getClientFingerprint();
    expect(fp.startsWith("fallback-")).toBe(true);
  });

  it("injects x-client-fingerprint header in clientFetch", async () => {
    mockWindow();
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/client-identity");
    await mod.clientFetch("/api/x", { method: "POST" });

    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-client-fingerprint")).toBeTruthy();
  });

  it("waits for FingerprintJS before sending mutation requests", async () => {
    mockWindow();
    let markGetStarted: (() => void) | null = null;
    let resolveGet: ((value: { visitorId: string }) => void) | null = null;
    const getStarted = new Promise<void>((resolve) => {
      markGetStarted = resolve;
    });
    const getResult = new Promise<{ visitorId: string }>((resolve) => {
      resolveGet = resolve;
    });
    hoisted.fpLoadMock.mockResolvedValue({
      get: vi.fn(
        () => {
          markGetStarted?.();
          return getResult;
        },
      ),
    });
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/client-identity");
    const pendingFetch = mod.clientFetch("/api/x", { method: "POST" });

    await getStarted;
    expect(fetchMock).not.toHaveBeenCalled();
    resolveGet?.({ visitorId: "fp-123" });
    await pendingFetch;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-client-fingerprint")).toBe("fp-123");
  });

  it("reuses the same fallback fingerprint when localStorage is unavailable", async () => {
    const badStorage = {
      getItem: vi.fn(() => {
        throw new Error("denied");
      }),
      setItem: vi.fn(() => {
        throw new Error("denied");
      }),
    } as unknown as Storage;

    Object.defineProperty(globalThis, "window", {
      value: { localStorage: badStorage },
      configurable: true,
      writable: true,
    });
    hoisted.fpLoadMock.mockReturnValue(new Promise(() => {}) as Promise<{ get: () => Promise<{ visitorId: string }> }>);
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("../src/lib/client-identity");
    await mod.clientFetch("/api/x", { method: "GET" });
    await mod.clientFetch("/api/y", { method: "GET" });

    const firstHeaders = new Headers((fetchMock.mock.calls[0] as [RequestInfo, RequestInit])[1].headers);
    const secondHeaders = new Headers((fetchMock.mock.calls[1] as [RequestInfo, RequestInit])[1].headers);
    expect(firstHeaders.get("x-client-fingerprint")).toBe(secondHeaders.get("x-client-fingerprint"));
    expect(firstHeaders.get("x-client-fingerprint")).toMatch(/^fallback-/);
  });
});
