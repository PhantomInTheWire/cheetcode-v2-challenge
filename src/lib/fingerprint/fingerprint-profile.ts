"use client";

import { getClientFingerprintState } from "@/lib/fingerprint/client-identity";
import {
  buildCompactFingerprintSummary,
  type AutomationConfidence,
  type AutomationVerdict,
  type ClientFingerprintProfile,
  type CompactFingerprintSummary,
} from "@/lib/fingerprint/fingerprint-shared";

let fingerprintProfilePromise: Promise<ClientFingerprintProfile> | null = null;
let cachedFingerprintProfile: ClientFingerprintProfile | null = null;

function hashValue(raw: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ 0x9e3779b9;
    h2 = Math.imul(h2, 0x01000193);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

function safeBoolean(test: () => unknown): boolean {
  try {
    return Boolean(test());
  } catch {
    return false;
  }
}

function safeStorageAvailable(kind: "localStorage" | "sessionStorage"): boolean {
  try {
    const storage = window[kind];
    const key = "__ctf_fp_probe__";
    storage.setItem(key, "1");
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function normalizeString(value: string | null | undefined, maxLength: number = 160): string {
  return (value ?? "").trim().slice(0, maxLength);
}

function getOrientation(): string {
  try {
    const orientation = screen.orientation;
    if (orientation?.type) return `${orientation.type}:${orientation.angle}`;
  } catch {
    // ignore
  }
  return "";
}

function getWebGlInfo(): {
  vendor: string;
  renderer: string;
  supported: boolean;
  supported2: boolean;
} {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    const gl2 = canvas.getContext("webgl2");
    if (!gl) {
      return { vendor: "", renderer: "", supported: false, supported2: Boolean(gl2) };
    }
    const dbg = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg
      ? normalizeString(
          String((gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_VENDOR_WEBGL)),
          120,
        )
      : "";
    const renderer = dbg
      ? normalizeString(
          String((gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL)),
          160,
        )
      : "";
    return { vendor, renderer, supported: true, supported2: Boolean(gl2) };
  } catch {
    return { vendor: "", renderer: "", supported: false, supported2: false };
  }
}

async function queryPermission(
  name: "geolocation" | "camera" | "microphone" | "clipboard-read" | "notifications",
): Promise<string> {
  try {
    if (!("permissions" in navigator) || !navigator.permissions?.query) return "unsupported";
    const result = await navigator.permissions.query({ name } as PermissionDescriptor);
    return normalizeString(result.state, 32) || "unknown";
  } catch {
    return "unsupported";
  }
}

function classifyAutomation(profile: Omit<ClientFingerprintProfile, "derived">): {
  automationVerdict: AutomationVerdict;
  automationConfidence: AutomationConfidence;
  reasonCodes: string[];
} {
  const reasons: string[] = [];
  if (profile.automationSignals.webdriver) reasons.push("webdriver");
  if (profile.automationSignals.playwright) reasons.push("playwright");
  if (profile.automationSignals.puppeteer) reasons.push("puppeteer");
  if (profile.automationSignals.headlessUa) reasons.push("headless_ua");
  if (profile.automationSignals.missingLanguages) reasons.push("missing_languages");
  if (profile.automationSignals.missingPlugins) reasons.push("missing_plugins");
  if (profile.automationSignals.windowSizeMismatch) reasons.push("window_mismatch");

  const strong =
    Number(profile.automationSignals.webdriver) +
    Number(profile.automationSignals.playwright) +
    Number(profile.automationSignals.puppeteer) +
    Number(profile.automationSignals.headlessUa);
  const weak =
    Number(profile.automationSignals.missingLanguages) +
    Number(profile.automationSignals.missingPlugins) +
    Number(profile.automationSignals.windowSizeMismatch);

  if (strong >= 1 || weak >= 3) {
    return {
      automationVerdict: "likely_automation",
      automationConfidence: strong >= 2 ? "high" : "medium",
      reasonCodes: reasons,
    };
  }
  if (weak >= 1) {
    return {
      automationVerdict: "possibly_automation",
      automationConfidence: "low",
      reasonCodes: reasons,
    };
  }
  return {
    automationVerdict: "normal",
    automationConfidence: "low",
    reasonCodes: reasons,
  };
}

function buildDerived(
  profile: Omit<ClientFingerprintProfile, "derived">,
): ClientFingerprintProfile["derived"] {
  const automation = classifyAutomation(profile);
  const environmentHash = hashValue(JSON.stringify(profile.environment));
  const displayHash = hashValue(JSON.stringify(profile.display));
  const hardwareHash = hashValue(JSON.stringify(profile.hardware));
  const capabilityHash = hashValue(JSON.stringify(profile.capabilities));
  const renderingHash = hashValue(JSON.stringify(profile.rendering));
  const permissionHash = hashValue(JSON.stringify(profile.permissions));
  const deviceClusterKey = hashValue(
    JSON.stringify({
      platform: profile.environment.platform,
      timezone: profile.environment.timezone,
      language: profile.environment.language,
      screen: `${profile.display.screenWidth}x${profile.display.screenHeight}`,
      dpr: profile.display.devicePixelRatio,
      cpu: profile.hardware.hardwareConcurrency,
      memory: profile.hardware.deviceMemory,
      touch: profile.hardware.maxTouchPoints,
    }),
  );
  const renderClusterKey = hashValue(
    JSON.stringify({
      vendor: profile.rendering.webGlVendor,
      renderer: profile.rendering.webGlRenderer,
      screen: `${profile.display.screenWidth}x${profile.display.screenHeight}`,
    }),
  );
  const localeClusterKey = hashValue(
    JSON.stringify({
      language: profile.environment.language,
      languages: profile.environment.languages,
      timezone: profile.environment.timezone,
    }),
  );
  const profileHash = hashValue(
    JSON.stringify({
      identity: {
        fingerprintId: profile.fingerprintId,
        fingerprintSource: profile.fingerprintSource,
      },
      environmentHash,
      displayHash,
      hardwareHash,
      capabilityHash,
      renderingHash,
      permissionHash,
    }),
  );

  return {
    ...automation,
    environmentHash,
    displayHash,
    hardwareHash,
    capabilityHash,
    renderingHash,
    permissionHash,
    profileHash,
    deviceClusterKey,
    renderClusterKey,
    localeClusterKey,
  };
}

async function collectFingerprintProfile(): Promise<ClientFingerprintProfile> {
  const [{ fingerprintId, fingerprintSource }, permissions] = await Promise.all([
    getClientFingerprintState(),
    Promise.all([
      queryPermission("notifications"),
      queryPermission("geolocation"),
      queryPermission("camera"),
      queryPermission("microphone"),
      queryPermission("clipboard-read"),
    ]),
  ]);

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      rtt?: number;
      downlink?: number;
      saveData?: boolean;
    };
  };
  const webGl = getWebGlInfo();
  const profileBase: Omit<ClientFingerprintProfile, "derived"> = {
    profileVersion: 1,
    collectedAt: Date.now(),
    fingerprintId,
    fingerprintSource,
    environment: {
      userAgent: normalizeString(nav.userAgent, 320),
      platform: normalizeString(nav.platform, 80),
      vendor: normalizeString(nav.vendor, 80),
      language: normalizeString(nav.language, 32),
      languages: Array.from(
        new Set((nav.languages ?? []).map((value) => normalizeString(value, 32)).filter(Boolean)),
      ),
      timezone: normalizeString(Intl.DateTimeFormat().resolvedOptions().timeZone, 64),
      locale: normalizeString(Intl.DateTimeFormat().resolvedOptions().locale, 64),
      cookieEnabled: Boolean(nav.cookieEnabled),
      doNotTrack: normalizeString(nav.doNotTrack, 16),
      online: nav.onLine,
    },
    display: {
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      devicePixelRatio: Number(window.devicePixelRatio || 1),
      colorDepth: window.screen.colorDepth,
      pixelDepth: window.screen.pixelDepth,
      orientation: getOrientation(),
    },
    hardware: {
      hardwareConcurrency: Number(nav.hardwareConcurrency || 0),
      deviceMemory: Number(nav.deviceMemory || 0),
      maxTouchPoints: Number(nav.maxTouchPoints || 0),
    },
    capabilities: {
      localStorage: safeStorageAvailable("localStorage"),
      sessionStorage: safeStorageAvailable("sessionStorage"),
      indexedDb: safeBoolean(() => window.indexedDB),
      serviceWorker: safeBoolean(() => navigator.serviceWorker),
      broadcastChannel: safeBoolean(() => window.BroadcastChannel),
      sharedWorker: safeBoolean(() => window.SharedWorker),
      webSocket: safeBoolean(() => window.WebSocket),
      webRtc: safeBoolean(() => window.RTCPeerConnection),
      notificationApi: safeBoolean(() => window.Notification),
      permissionsApi: safeBoolean(() => navigator.permissions),
      clipboardApi: safeBoolean(() => navigator.clipboard),
      mediaDevices: safeBoolean(() => navigator.mediaDevices),
      webGl: webGl.supported,
      webGl2: webGl.supported2,
    },
    browserCounts: {
      plugins: nav.plugins?.length ?? 0,
      mimeTypes: nav.mimeTypes?.length ?? 0,
    },
    rendering: {
      webGlVendor: webGl.vendor,
      webGlRenderer: webGl.renderer,
    },
    networkHints: {
      effectiveType: normalizeString(nav.connection?.effectiveType, 16),
      rtt: Number(nav.connection?.rtt || 0),
      downlink: Number(nav.connection?.downlink || 0),
      saveData: Boolean(nav.connection?.saveData),
    },
    permissions: {
      notifications: permissions[0],
      geolocation: permissions[1],
      camera: permissions[2],
      microphone: permissions[3],
      clipboardRead: permissions[4],
    },
    automationSignals: {
      webdriver: Boolean((nav as Navigator & { webdriver?: boolean }).webdriver),
      headlessUa: /HeadlessChrome|PhantomJS|Electron/i.test(nav.userAgent),
      playwright: "__playwright__binding__" in window || "__pwInitScripts" in window,
      puppeteer: "__puppeteer_utility_world__" in window || "__nightmare" in window,
      missingPlugins: (nav.plugins?.length ?? 0) === 0,
      missingLanguages: (nav.languages?.length ?? 0) === 0,
      windowSizeMismatch:
        Math.abs(window.outerWidth - window.innerWidth) < 4 &&
        Math.abs(window.outerHeight - window.innerHeight) < 4,
    },
  };

  return {
    ...profileBase,
    derived: buildDerived(profileBase),
  };
}

export function getCachedFingerprintSummary(): CompactFingerprintSummary | null {
  if (!cachedFingerprintProfile) return null;
  return buildCompactFingerprintSummary(cachedFingerprintProfile);
}

export async function ensureClientFingerprintProfile(): Promise<ClientFingerprintProfile> {
  if (cachedFingerprintProfile) return cachedFingerprintProfile;
  if (!fingerprintProfilePromise) {
    fingerprintProfilePromise = collectFingerprintProfile().then((profile) => {
      cachedFingerprintProfile = profile;
      return profile;
    });
  }
  return fingerprintProfilePromise;
}

export async function getClientFingerprintProfile(): Promise<ClientFingerprintProfile> {
  return await ensureClientFingerprintProfile();
}
