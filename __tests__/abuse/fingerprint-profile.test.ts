import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  getClientFingerprintStateMock: vi.fn(async () => ({
    fingerprintId: "fp-real-visitor-id",
    fingerprintSource: "fingerprintjs" as const,
  })),
}));

vi.mock("../../src/lib/fingerprint/client-identity", () => ({
  getClientFingerprintState: hoisted.getClientFingerprintStateMock,
}));

function createStorage(): Storage {
  const storage = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
    }),
    clear: vi.fn(() => {
      storage.clear();
    }),
    key: vi.fn(),
    get length() {
      return storage.size;
    },
  } as unknown as Storage;
}

function installBrowserMocks(overrides?: {
  webdriver?: boolean;
  userAgent?: string;
  languages?: string[];
}) {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const screenValue = {
    width: 1728,
    height: 1117,
    availWidth: 1728,
    availHeight: 1077,
    colorDepth: 24,
    pixelDepth: 24,
    orientation: { type: "landscape-primary", angle: 0 },
  };

  Object.defineProperty(globalThis, "screen", {
    value: screenValue,
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, "window", {
    value: {
      screen: screenValue,
      innerWidth: 1440,
      innerHeight: 900,
      outerWidth: 1456,
      outerHeight: 938,
      devicePixelRatio: 2,
      localStorage,
      sessionStorage,
      indexedDB: {},
      BroadcastChannel: function BroadcastChannel() {},
      SharedWorker: function SharedWorker() {},
      WebSocket: function WebSocket() {},
      RTCPeerConnection: function RTCPeerConnection() {},
      Notification: function Notification() {},
      ...(overrides?.webdriver ? { __playwright__binding__: {} } : {}),
    },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, "document", {
    value: {
      createElement: vi.fn(() => ({
        getContext: vi.fn((kind: string) => {
          if (kind === "webgl" || kind === "experimental-webgl") {
            return {
              getExtension: vi.fn(() => ({
                UNMASKED_VENDOR_WEBGL: "vendor",
                UNMASKED_RENDERER_WEBGL: "renderer",
              })),
              getParameter: vi.fn((name: string) =>
                name === "vendor" ? "Apple Inc." : "Apple GPU",
              ),
            };
          }
          if (kind === "webgl2") {
            return {};
          }
          return null;
        }),
      })),
    },
    configurable: true,
    writable: true,
  });

  Object.defineProperty(globalThis, "navigator", {
    value: {
      userAgent:
        overrides?.userAgent ??
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/123.0.0.0 Safari/537.36",
      platform: "MacIntel",
      vendor: "Google Inc.",
      language: "en-US",
      languages: overrides?.languages ?? ["en-US", "en"],
      cookieEnabled: true,
      doNotTrack: "1",
      onLine: true,
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      plugins: [{ name: "Chrome PDF Viewer" }],
      mimeTypes: [{ type: "application/pdf" }, { type: "text/pdf" }],
      webdriver: overrides?.webdriver ?? false,
      permissions: {
        query: vi.fn(async ({ name }: { name: string }) => ({
          state: name === "notifications" ? "granted" : "prompt",
        })),
      },
      serviceWorker: {},
      clipboard: {},
      mediaDevices: {},
      connection: {
        effectiveType: "4g",
        rtt: 50,
        downlink: 20,
        saveData: false,
      },
    },
    configurable: true,
    writable: true,
  });
}

describe("fingerprint-profile", () => {
  beforeEach(() => {
    vi.resetModules();
    hoisted.getClientFingerprintStateMock.mockReset();
    hoisted.getClientFingerprintStateMock.mockResolvedValue({
      fingerprintId: "fp-real-visitor-id",
      fingerprintSource: "fingerprintjs",
    });
    installBrowserMocks();
  });

  it("collects a normalized profile with locale, display, rendering, and hashes", async () => {
    const mod = await import("../../src/lib/fingerprint/fingerprint-profile");
    const profile = await mod.ensureClientFingerprintProfile();
    const summary = mod.getCachedFingerprintSummary();

    expect(profile.fingerprintId).toBe("fp-real-visitor-id");
    expect(profile.environment.language).toBe("en-US");
    expect(profile.environment.timezone).toBeTruthy();
    expect(profile.display.screenWidth).toBe(1728);
    expect(profile.rendering.webGlVendor).toBe("Apple Inc.");
    expect(profile.derived.profileHash).toMatch(/^[a-f0-9]{16}$/);
    expect(summary?.automation.automationVerdict).toBe("normal");
    expect(summary?.hashes.deviceClusterKey).toMatch(/^[a-f0-9]{16}$/);
  });

  it("marks strong browser automation indicators as likely automation", async () => {
    installBrowserMocks({
      webdriver: true,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/123.0.0.0 Safari/537.36",
      languages: [],
    });

    const mod = await import("../../src/lib/fingerprint/fingerprint-profile");
    const profile = await mod.ensureClientFingerprintProfile();

    expect(profile.derived.automationVerdict).toBe("likely_automation");
    expect(profile.derived.reasonCodes).toEqual(
      expect.arrayContaining(["webdriver", "playwright", "headless_ua", "missing_languages"]),
    );
  });
});
