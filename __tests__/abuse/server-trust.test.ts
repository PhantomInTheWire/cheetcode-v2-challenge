import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTrustedFingerprintCookiePayload,
  createTrustedFingerprintCookieValue,
  deriveTrustedFingerprintFromHints,
  resolveFingerprintTrust,
  verifyTrustedFingerprintCookieValue,
} from "../../src/lib/fingerprint/server-trust";

function makeHints(fingerprintId: string, overrides?: Partial<ReturnType<typeof makeHintsBase>>) {
  return {
    ...makeHintsBase(fingerprintId),
    ...overrides,
  };
}

function makeHintsBase(fingerprintId: string) {
  return {
    profileVersion: 1 as const,
    collectedAt: 1_710_000_000_000,
    fingerprintId,
    fingerprintSource: "fingerprintjs" as const,
    environment: {
      language: "en-US",
      languages: ["en-US", "en"],
      timezone: "UTC",
    },
    display: {
      screenWidth: 1440,
      screenHeight: 900,
      innerWidth: 1440,
      innerHeight: 820,
      devicePixelRatio: 2,
    },
    hardware: {
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
    },
    rendering: {
      webGlVendor: "WebKit",
      webGlRenderer: "Apple GPU",
    },
    automation: {
      automationVerdict: "normal" as const,
      automationConfidence: "low" as const,
      reasonCodes: [],
    },
  };
}

describe("server fingerprint trust", () => {
  afterEach(() => {
    delete process.env.FINGERPRINT_COOKIE_SECRET;
    delete process.env.CONVEX_MUTATION_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    vi.restoreAllMocks();
  });

  it("signs and verifies trusted fingerprint cookies", async () => {
    process.env.CONVEX_MUTATION_SECRET = "secret";
    const request = new Request("http://localhost/api/session", {
      headers: {
        "user-agent": "Vitest Browser",
        "accept-language": "en-US,en;q=0.9",
        "x-client-fingerprint": "fingerprint-a",
      },
    });
    const summary = deriveTrustedFingerprintFromHints(makeHints("fingerprint-a"), request);
    const payload = createTrustedFingerprintCookiePayload(summary);
    expect(payload).toBeTruthy();
    if (!payload) {
      throw new Error("expected trusted fingerprint cookie payload");
    }
    const cookie = await createTrustedFingerprintCookieValue(payload);
    expect(cookie).toContain("v2.");
    await expect(verifyTrustedFingerprintCookieValue(cookie ?? undefined)).resolves.toMatchObject({
      tokenVersion: "v2",
      trustedFingerprint: summary.trustedFingerprint,
    });
  });

  it("rejects legacy v1 cookie values", async () => {
    process.env.CONVEX_MUTATION_SECRET = "secret";
    await expect(
      verifyTrustedFingerprintCookieValue("v1.srvfp-deadbeefcafebabe.signature"),
    ).resolves.toBeNull();
  });

  it("derives a different trusted fingerprint when the claimed fingerprintId changes", () => {
    const request = new Request("http://localhost/api/session", {
      headers: {
        "user-agent": "Vitest Browser",
        "accept-language": "en-US,en;q=0.9",
        "x-client-fingerprint": "fingerprint-a",
      },
    });

    const first = deriveTrustedFingerprintFromHints(makeHints("fingerprint-a"), request);
    const second = deriveTrustedFingerprintFromHints(
      makeHints("fingerprint-b"),
      new Request("http://localhost/api/session", {
        headers: {
          "user-agent": "Vitest Browser",
          "accept-language": "en-US,en;q=0.9",
          "x-client-fingerprint": "fingerprint-b",
        },
      }),
    );

    expect(first.trustedFingerprint).not.toBe(second.trustedFingerprint);
    expect(first.hashes.stableDeviceClusterKey).toBe(second.hashes.stableDeviceClusterKey);
    expect(first.hashes.profileHash).not.toBe(second.hashes.profileHash);
  });

  it("ignores viewport-only drift for promotion identity", () => {
    const baseRequest = new Request("http://localhost/api/session", {
      headers: {
        "user-agent": "Vitest Browser",
        "accept-language": "en-US,en;q=0.9",
        "x-client-fingerprint": "fingerprint-a",
      },
    });

    const first = deriveTrustedFingerprintFromHints(makeHints("fingerprint-a"), baseRequest);
    const second = deriveTrustedFingerprintFromHints(
      makeHints("fingerprint-a", {
        display: {
          ...makeHintsBase("fingerprint-a").display,
          innerWidth: 1111,
          innerHeight: 777,
        },
      }),
      baseRequest,
    );

    expect(first.hashes.displayHash).not.toBe(second.hashes.displayHash);
    expect(first.hashes.stableDisplayHash).toBe(second.hashes.stableDisplayHash);
    expect(first.hashes.localeClusterKey).not.toBe(first.hashes.environmentHash);
    expect(first.trustedFingerprint).toBe(second.trustedFingerprint);
  });

  it("does not mint a trusted cookie when the client header mismatches the hinted fingerprint", async () => {
    const request = new Request("http://localhost/api/session", {
      headers: {
        "user-agent": "Vitest Browser",
        "accept-language": "en-US,en;q=0.9",
        "x-client-fingerprint": "fingerprint-b",
      },
    });

    const trust = await resolveFingerprintTrust(request, makeHints("fingerprint-a"), {
      allowPromotion: true,
    });

    expect(trust.cookiePayloadToSet).toBeNull();
    expect(trust.summary?.trust.promotionDecision).toBe("client_header_mismatch");
  });

  it("warns when the signing secret is missing", async () => {
    delete process.env.FINGERPRINT_COOKIE_SECRET;
    delete process.env.CONVEX_MUTATION_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const request = new Request("http://localhost/api/session", {
      headers: {
        "user-agent": "Vitest Browser",
        "accept-language": "en-US,en;q=0.9",
        "x-client-fingerprint": "fingerprint-a",
      },
    });
    const summary = deriveTrustedFingerprintFromHints(makeHints("fingerprint-a"), request);
    const payload = createTrustedFingerprintCookiePayload(summary);
    const cookie = await createTrustedFingerprintCookieValue(payload!);

    expect(cookie).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "[fingerprint-trust] missing signing secret; trusted fingerprint cookies cannot be issued",
    );
  });
});
