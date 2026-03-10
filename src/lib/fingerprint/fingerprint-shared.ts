export type AutomationVerdict = "normal" | "possibly_automation" | "likely_automation";
export type AutomationConfidence = "low" | "medium" | "high";

export type ClientFingerprintProfile = {
  profileVersion: 1;
  collectedAt: number;
  fingerprintId: string;
  fingerprintSource: "fingerprintjs" | "fallback";
  environment: {
    userAgent: string;
    platform: string;
    vendor: string;
    language: string;
    languages: string[];
    timezone: string;
    locale: string;
    cookieEnabled: boolean;
    doNotTrack: string;
    online: boolean;
  };
  display: {
    screenWidth: number;
    screenHeight: number;
    availWidth: number;
    availHeight: number;
    innerWidth: number;
    innerHeight: number;
    outerWidth: number;
    outerHeight: number;
    devicePixelRatio: number;
    colorDepth: number;
    pixelDepth: number;
    orientation: string;
  };
  hardware: {
    hardwareConcurrency: number;
    deviceMemory: number;
    maxTouchPoints: number;
  };
  capabilities: {
    localStorage: boolean;
    sessionStorage: boolean;
    indexedDb: boolean;
    serviceWorker: boolean;
    broadcastChannel: boolean;
    sharedWorker: boolean;
    webSocket: boolean;
    webRtc: boolean;
    notificationApi: boolean;
    permissionsApi: boolean;
    clipboardApi: boolean;
    mediaDevices: boolean;
    webGl: boolean;
    webGl2: boolean;
  };
  browserCounts: {
    plugins: number;
    mimeTypes: number;
  };
  rendering: {
    webGlVendor: string;
    webGlRenderer: string;
  };
  networkHints: {
    effectiveType: string;
    rtt: number;
    downlink: number;
    saveData: boolean;
  };
  permissions: {
    notifications: string;
    geolocation: string;
    camera: string;
    microphone: string;
    clipboardRead: string;
  };
  automationSignals: {
    webdriver: boolean;
    headlessUa: boolean;
    playwright: boolean;
    puppeteer: boolean;
    missingPlugins: boolean;
    missingLanguages: boolean;
    windowSizeMismatch: boolean;
  };
  derived: {
    automationVerdict: AutomationVerdict;
    automationConfidence: AutomationConfidence;
    reasonCodes: string[];
    environmentHash: string;
    displayHash: string;
    hardwareHash: string;
    capabilityHash: string;
    renderingHash: string;
    permissionHash: string;
    profileHash: string;
    deviceClusterKey: string;
    renderClusterKey: string;
    localeClusterKey: string;
  };
};

export type CompactFingerprintSummary = Pick<
  ClientFingerprintProfile,
  "profileVersion" | "fingerprintId" | "fingerprintSource" | "collectedAt"
> & {
  environment: Pick<ClientFingerprintProfile["environment"], "language" | "languages" | "timezone">;
  display: Pick<
    ClientFingerprintProfile["display"],
    "screenWidth" | "screenHeight" | "innerWidth" | "innerHeight" | "devicePixelRatio"
  >;
  hardware: ClientFingerprintProfile["hardware"];
  rendering: ClientFingerprintProfile["rendering"];
  automation: Pick<
    ClientFingerprintProfile["derived"],
    "automationVerdict" | "automationConfidence" | "reasonCodes"
  >;
  hashes: Pick<
    ClientFingerprintProfile["derived"],
    | "environmentHash"
    | "displayHash"
    | "hardwareHash"
    | "capabilityHash"
    | "renderingHash"
    | "permissionHash"
    | "profileHash"
    | "deviceClusterKey"
    | "renderClusterKey"
    | "localeClusterKey"
  >;
};

export type UnverifiedFingerprintHints = Pick<
  ClientFingerprintProfile,
  "profileVersion" | "fingerprintId" | "fingerprintSource" | "collectedAt"
> & {
  environment: Pick<ClientFingerprintProfile["environment"], "language" | "languages" | "timezone">;
  display: Pick<
    ClientFingerprintProfile["display"],
    "screenWidth" | "screenHeight" | "innerWidth" | "innerHeight" | "devicePixelRatio"
  >;
  hardware: ClientFingerprintProfile["hardware"];
  rendering: ClientFingerprintProfile["rendering"];
  automation?: {
    automationVerdict:
      | ClientFingerprintProfile["derived"]["automationVerdict"]
      | "unverified_invalid_or_missing";
    automationConfidence:
      | ClientFingerprintProfile["derived"]["automationConfidence"]
      | "unverified_invalid_or_missing";
    reasonCodes: string[];
  };
};

export function buildCompactFingerprintSummary(
  profile: ClientFingerprintProfile,
): CompactFingerprintSummary {
  return {
    profileVersion: profile.profileVersion,
    fingerprintId: profile.fingerprintId,
    fingerprintSource: profile.fingerprintSource,
    collectedAt: profile.collectedAt,
    environment: {
      language: profile.environment.language,
      languages: profile.environment.languages,
      timezone: profile.environment.timezone,
    },
    display: {
      screenWidth: profile.display.screenWidth,
      screenHeight: profile.display.screenHeight,
      innerWidth: profile.display.innerWidth,
      innerHeight: profile.display.innerHeight,
      devicePixelRatio: profile.display.devicePixelRatio,
    },
    hardware: profile.hardware,
    rendering: profile.rendering,
    automation: {
      automationVerdict: profile.derived.automationVerdict,
      automationConfidence: profile.derived.automationConfidence,
      reasonCodes: profile.derived.reasonCodes,
    },
    hashes: {
      environmentHash: profile.derived.environmentHash,
      displayHash: profile.derived.displayHash,
      hardwareHash: profile.derived.hardwareHash,
      capabilityHash: profile.derived.capabilityHash,
      renderingHash: profile.derived.renderingHash,
      permissionHash: profile.derived.permissionHash,
      profileHash: profile.derived.profileHash,
      deviceClusterKey: profile.derived.deviceClusterKey,
      renderClusterKey: profile.derived.renderClusterKey,
      localeClusterKey: profile.derived.localeClusterKey,
    },
  };
}

export function buildUnverifiedFingerprintHints(
  profile: ClientFingerprintProfile | CompactFingerprintSummary,
): UnverifiedFingerprintHints {
  return {
    profileVersion: profile.profileVersion,
    fingerprintId: profile.fingerprintId,
    fingerprintSource: profile.fingerprintSource,
    collectedAt: profile.collectedAt,
    environment: {
      language: profile.environment.language,
      languages: profile.environment.languages,
      timezone: profile.environment.timezone,
    },
    display: {
      screenWidth: profile.display.screenWidth,
      screenHeight: profile.display.screenHeight,
      innerWidth: profile.display.innerWidth,
      innerHeight: profile.display.innerHeight,
      devicePixelRatio: profile.display.devicePixelRatio,
    },
    hardware: profile.hardware,
    rendering: profile.rendering,
    automation:
      "automation" in profile
        ? {
            automationVerdict: profile.automation.automationVerdict,
            automationConfidence: profile.automation.automationConfidence,
            reasonCodes: profile.automation.reasonCodes,
          }
        : {
            automationVerdict: profile.derived.automationVerdict,
            automationConfidence: profile.derived.automationConfidence,
            reasonCodes: profile.derived.reasonCodes,
          },
  };
}

function asString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asAutomationVerdict(
  value: unknown,
): AutomationVerdict | "unverified_invalid_or_missing" {
  if (value === "normal" || value === "possibly_automation" || value === "likely_automation") {
    return value;
  }
  return "unverified_invalid_or_missing";
}

function asAutomationConfidence(
  value: unknown,
): AutomationConfidence | "unverified_invalid_or_missing" {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return "unverified_invalid_or_missing";
}

function asStringArray(value: unknown, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry, maxLength))
    .filter((entry): entry is string => Boolean(entry));
}

export function parseUnverifiedFingerprintHints(
  value: unknown,
): UnverifiedFingerprintHints | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const environment =
    input.environment && typeof input.environment === "object"
      ? (input.environment as Record<string, unknown>)
      : {};
  const display =
    input.display && typeof input.display === "object"
      ? (input.display as Record<string, unknown>)
      : {};
  const hardware =
    input.hardware && typeof input.hardware === "object"
      ? (input.hardware as Record<string, unknown>)
      : {};
  const rendering =
    input.rendering && typeof input.rendering === "object"
      ? (input.rendering as Record<string, unknown>)
      : {};
  const automation =
    input.automation && typeof input.automation === "object"
      ? (input.automation as Record<string, unknown>)
      : input.derived && typeof input.derived === "object"
        ? (input.derived as Record<string, unknown>)
        : {};

  const fingerprintId = asString(input.fingerprintId, 128);
  const language = asString(environment.language, 32);
  const timezone = asString(environment.timezone, 64);
  const webGlVendor = asString(rendering.webGlVendor, 120);
  const webGlRenderer = asString(rendering.webGlRenderer, 160);
  const screenWidth = asNumber(display.screenWidth);
  const screenHeight = asNumber(display.screenHeight);
  if (
    !fingerprintId &&
    !language &&
    !timezone &&
    !webGlVendor &&
    !webGlRenderer &&
    !screenWidth &&
    !screenHeight
  ) {
    return undefined;
  }

  return {
    profileVersion: 1,
    fingerprintId: fingerprintId ?? "unknown",
    fingerprintSource: input.fingerprintSource === "fingerprintjs" ? "fingerprintjs" : "fallback",
    collectedAt: asNumber(input.collectedAt) ?? Date.now(),
    environment: {
      language: language ?? "",
      languages: asStringArray(environment.languages, 32),
      timezone: timezone ?? "",
    },
    display: {
      screenWidth: screenWidth ?? 0,
      screenHeight: screenHeight ?? 0,
      innerWidth: asNumber(display.innerWidth) ?? 0,
      innerHeight: asNumber(display.innerHeight) ?? 0,
      devicePixelRatio: asNumber(display.devicePixelRatio) ?? 0,
    },
    hardware: {
      hardwareConcurrency: asNumber(hardware.hardwareConcurrency) ?? 0,
      deviceMemory: asNumber(hardware.deviceMemory) ?? 0,
      maxTouchPoints: asNumber(hardware.maxTouchPoints) ?? 0,
    },
    rendering: {
      webGlVendor: webGlVendor ?? "",
      webGlRenderer: webGlRenderer ?? "",
    },
    automation: {
      automationVerdict: asAutomationVerdict(automation.automationVerdict),
      automationConfidence: asAutomationConfidence(automation.automationConfidence),
      reasonCodes: asStringArray(automation.reasonCodes, 48),
    },
  };
}
