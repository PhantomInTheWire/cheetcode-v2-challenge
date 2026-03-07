import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
  requireAuthMock: vi.fn(async () => ({ ok: true, github: "tester" })),
  actionMock: vi.fn(async () => ({
    level: 1,
    problems: [
      {
        id: "p1",
        title: "T",
        tier: "easy",
        description: "D",
        signature: "solve(a, b)",
        starterCode: "",
        testCases: [{ input: { a: 1, b: 2 }, expected: 3 }],
      },
    ],
  })),
  getLevel3ChallengeFromIdMock: vi.fn(() => null),
}));

vi.mock("../../src/lib/auth/request-auth", () => ({
  requireAuthenticatedGithub: hoisted.requireAuthMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    action = hoisted.actionMock;
  },
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void callback();
    },
  };
});

vi.mock("../../server/level3/problems", () => ({
  getLevel3ChallengeFromId: hoisted.getLevel3ChallengeFromIdMock,
}));

describe("/api/session", () => {
  beforeEach(() => {
    hoisted.requireAuthMock.mockReset();
    hoisted.actionMock.mockReset();
    hoisted.getLevel3ChallengeFromIdMock.mockReset();
    hoisted.requireAuthMock.mockResolvedValue({ ok: true, github: "tester" });
    hoisted.actionMock.mockResolvedValue({
      level: 1,
      problems: [
        {
          id: "p1",
          title: "T",
          tier: "easy",
          description: "D",
          signature: "solve(a, b)",
          starterCode: "",
          testCases: [{ input: { a: 1, b: 2 }, expected: 3 }],
        },
      ],
    });
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
    process.env.CONVEX_MUTATION_SECRET = "secret";
  });

  function makeFingerprintProfile() {
    return {
      profileVersion: 1,
      collectedAt: 1_710_000_000_000,
      fingerprintId: "fingerprint-1234",
      fingerprintSource: "fingerprintjs" as const,
      environment: {
        userAgent: "Vitest",
        platform: "MacIntel",
        vendor: "Google Inc.",
        language: "en-US",
        languages: ["en-US", "en"],
        timezone: "Asia/Kolkata",
        locale: "en-IN",
        cookieEnabled: true,
        doNotTrack: "0",
        online: true,
      },
      display: {
        screenWidth: 1728,
        screenHeight: 1117,
        availWidth: 1728,
        availHeight: 1077,
        innerWidth: 1440,
        innerHeight: 900,
        outerWidth: 1440,
        outerHeight: 950,
        devicePixelRatio: 2,
        colorDepth: 24,
        pixelDepth: 24,
        orientation: "landscape-primary",
      },
      hardware: {
        hardwareConcurrency: 8,
        deviceMemory: 8,
        maxTouchPoints: 0,
      },
      capabilities: {
        localStorage: true,
        sessionStorage: true,
        indexedDb: true,
        serviceWorker: true,
        broadcastChannel: true,
        sharedWorker: false,
        webSocket: true,
        webRtc: true,
        notificationApi: true,
        permissionsApi: true,
        clipboardApi: true,
        mediaDevices: true,
        webGl: true,
        webGl2: true,
      },
      browserCounts: {
        plugins: 3,
        mimeTypes: 2,
      },
      rendering: {
        webGlVendor: "WebKit",
        webGlRenderer: "Apple GPU",
      },
      networkHints: {
        effectiveType: "4g",
        rtt: 50,
        downlink: 10,
        saveData: false,
      },
      permissions: {
        notifications: "granted",
        geolocation: "prompt",
        camera: "prompt",
        microphone: "prompt",
        clipboardRead: "denied",
      },
      automationSignals: {
        webdriver: false,
        headlessUa: false,
        playwright: false,
        puppeteer: false,
        missingPlugins: false,
        missingLanguages: false,
        windowSizeMismatch: false,
      },
      derived: {
        automationVerdict: "normal" as const,
        automationConfidence: "high" as const,
        reasonCodes: [],
        environmentHash: "envhash1234",
        displayHash: "displayhash1234",
        hardwareHash: "hardwarehash1234",
        capabilityHash: "capabilityhash1234",
        renderingHash: "renderinghash1234",
        permissionHash: "permissionhash1234",
        profileHash: "profilehash1234",
        deviceClusterKey: "devicecluster1234",
        renderClusterKey: "rendercluster1234",
        localeClusterKey: "localecluster1234",
      },
    };
  }

  it("returns unauthorized response when auth fails", async () => {
    hoisted.requireAuthMock.mockResolvedValueOnce({
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    });

    const { POST } = await import("../../src/app/api/session/route");
    const res = await POST(new Request("http://localhost/api/session", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("normalizes level1 test cases with args", async () => {
    hoisted.actionMock.mockResolvedValueOnce({
      level: 1,
      problems: [
        {
          id: "p1",
          title: "T",
          tier: "easy",
          description: "D",
          signature: "solve(a, b)",
          starterCode: "",
          testCases: [{ input: { a: 1, b: 2 }, expected: 3 }],
        },
      ],
    });

    const { POST } = await import("../../src/app/api/session/route");
    const req = new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ level: 1 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      level: number;
      problems: Array<{ testCases: Array<{ args?: unknown[] }> }>;
    };
    expect(body.level).toBe(1);
    expect(body.problems[0]?.testCases[0]?.args).toEqual([1, 2]);
  });

  it("builds a canonical level3 payload and records fingerprint identity metadata", async () => {
    hoisted.actionMock.mockReset();
    hoisted.actionMock
      .mockResolvedValueOnce({
        sessionId: "s3",
        startedAt: 10_000,
        expiresAt: 70_000,
        level: 3,
        scoreSnapshot: { elo: 7, solved: 1, rank: 2 },
        problems: [{ id: "l3:cpu-16bit-emulator:c:check-1", language: "c" }],
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });
    hoisted.getLevel3ChallengeFromIdMock.mockReturnValueOnce({
      id: "l3:cpu-16bit-emulator:c",
      title: "CPU Emulator",
      taskId: "cpu-16bit-emulator",
      taskName: "CPU Emulator",
      language: "c",
      spec: "Build the emulator",
      starterCode: "int main(void) { return 0; }",
      checks: [{ id: "boot", name: "Boots ROM" }],
    });

    const { POST } = await import("../../src/app/api/session/route");
    const req = new Request("http://localhost/api/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
        "x-client-fingerprint": "fingerprint-1234",
        "user-agent": "Vitest",
      },
      body: JSON.stringify({
        level: 3,
        level3ChallengeId: "l3:cpu-16bit-emulator:c",
        fingerprintProfile: makeFingerprintProfile(),
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      level: number;
      scoreSnapshot: { elo: number; solved: number; rank: number } | null;
      problems: Array<{ id: string; taskId?: string; checks: Array<{ id: string; name: string }> }>;
    };
    expect(body.level).toBe(3);
    expect(body.scoreSnapshot).toEqual({ elo: 7, solved: 1, rank: 2 });
    expect(body.problems).toEqual([
      {
        id: "l3:cpu-16bit-emulator:c",
        title: "CPU Emulator",
        taskId: "cpu-16bit-emulator",
        taskName: "CPU Emulator",
        language: "c",
        spec: "Build the emulator",
        starterCode: "int main(void) { return 0; }",
        checks: [{ id: "boot", name: "Boots ROM" }],
      },
    ]);

    expect(hoisted.actionMock).toHaveBeenCalledTimes(3);
    expect(hoisted.actionMock.mock.calls[0]?.[1]).toMatchObject({
      github: "tester",
      requestedLevel: 3,
      requestedLevel3ChallengeId: "l3:cpu-16bit-emulator:c",
    });
    expect(hoisted.actionMock.mock.calls[1]?.[1]).toMatchObject({
      sessionId: "s3",
      github: "tester",
      level: 3,
      route: "/api/session",
      screen: "playing",
    });
    expect(hoisted.actionMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        identities: [
          expect.objectContaining({ kind: "ip" }),
          expect.objectContaining({ kind: "fp" }),
        ],
      }),
    );
    expect(hoisted.actionMock.mock.calls[2]?.[1]).toMatchObject({
      sourceTrust: "server_derived_from_client_hints",
    });
    expect(JSON.parse(String(hoisted.actionMock.mock.calls[2]?.[1]?.summaryJson))).toMatchObject({
      fingerprintId: "fingerprint-1234",
      automation: {
        automationVerdict: "normal",
      },
      hashes: {
        profileHash: expect.any(String),
        deviceClusterKey: expect.any(String),
        fingerprintIdHash: expect.any(String),
        stableDeviceClusterKey: expect.any(String),
      },
      trustedFingerprint: expect.stringMatching(/^srvfp-/),
      trust: {
        promotionDecision: "minted_new_cookie",
        promotionEligible: true,
      },
    });
    expect(res.headers.get("set-cookie")).toContain("ctf_fp=v2.");
  });

  it("records a bootstrap fingerprint identity on first session create without fingerprint hints", async () => {
    hoisted.actionMock.mockReset();
    hoisted.actionMock
      .mockResolvedValueOnce({
        sessionId: "s1",
        startedAt: 10_000,
        expiresAt: 70_000,
        level: 1,
        scoreSnapshot: { elo: 0, solved: 0, rank: 0 },
        problems: [
          {
            id: "p1",
            title: "T",
            tier: "easy",
            description: "D",
            signature: "solve(a, b)",
            starterCode: "",
            testCases: [{ input: { a: 1, b: 2 }, expected: 3 }],
          },
        ],
      })
      .mockResolvedValueOnce({ ok: true });

    const { POST } = await import("../../src/app/api/session/route");
    const req = new Request("http://localhost/api/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
        "x-client-fingerprint": "fingerprint-1234",
        "user-agent": "Vitest",
      },
      body: JSON.stringify({ level: 1 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(hoisted.actionMock).toHaveBeenCalledTimes(2);
    expect(hoisted.actionMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        identities: [
          expect.objectContaining({ kind: "ip" }),
          expect.objectContaining({ kind: "fp" }),
        ],
      }),
    );
  });
});
