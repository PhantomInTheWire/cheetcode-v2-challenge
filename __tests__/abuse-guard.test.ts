import { beforeEach, describe, expect, it } from "vitest";
import {
  acquireLevel3InflightLock,
  clearShadowBanForIdentityKey,
  isIdentityKeyShadowBanned,
  releaseLevel3InflightLock,
  resetLevel3InflightLocksForTests,
  setShadowBanForIdentityKey,
} from "../src/lib/abuse/guard";

describe("level3 inflight guard", () => {
  beforeEach(() => {
    resetLevel3InflightLocksForTests();
  });

  it("blocks a second request from the same github account", () => {
    const req1 = new Request("http://localhost/api/validate-l3", {
      headers: { "x-forwarded-for": "203.0.113.10", "x-ctf-fingerprint": "fp-a" },
    });
    const req2 = new Request("http://localhost/api/finish-l3", {
      headers: { "x-forwarded-for": "198.51.100.20", "x-ctf-fingerprint": "fp-b" },
    });

    const first = acquireLevel3InflightLock(req1, "tester");
    expect(first.ok).toBe(true);

    const second = acquireLevel3InflightLock(req2, "tester");
    expect(second.ok).toBe(false);

    if (first.ok) {
      releaseLevel3InflightLock(first.lock);
    }
  });

  it("blocks a second request from the same ip even with a different github account", () => {
    const req1 = new Request("http://localhost/api/validate-l3", {
      headers: { "x-forwarded-for": "203.0.113.10", "x-ctf-fingerprint": "fp-a" },
    });
    const req2 = new Request("http://localhost/api/finish-l3", {
      headers: { "x-forwarded-for": "203.0.113.10", "x-ctf-fingerprint": "fp-b" },
    });

    const first = acquireLevel3InflightLock(req1, "tester-a");
    expect(first.ok).toBe(true);

    const second = acquireLevel3InflightLock(req2, "tester-b");
    expect(second.ok).toBe(false);

    if (first.ok) {
      releaseLevel3InflightLock(first.lock);
    }
  });

  it("blocks a second request from the same fingerprint even with a different github account and ip", () => {
    const req1 = new Request("http://localhost/api/validate-l3", {
      headers: { "x-forwarded-for": "203.0.113.10", "x-ctf-fingerprint": "shared-fp" },
    });
    const req2 = new Request("http://localhost/api/finish-l3", {
      headers: { "x-forwarded-for": "198.51.100.20", "x-ctf-fingerprint": "shared-fp" },
    });

    const first = acquireLevel3InflightLock(req1, "tester-a");
    expect(first.ok).toBe(true);

    const second = acquireLevel3InflightLock(req2, "tester-b");
    expect(second.ok).toBe(false);

    if (first.ok) {
      releaseLevel3InflightLock(first.lock);
    }
  });

  it("releases the lock after completion", () => {
    const req = new Request("http://localhost/api/validate-l3", {
      headers: { "x-forwarded-for": "203.0.113.10", "x-ctf-fingerprint": "fp-a" },
    });

    const first = acquireLevel3InflightLock(req, "tester");
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    releaseLevel3InflightLock(first.lock);

    const second = acquireLevel3InflightLock(req, "tester");
    expect(second.ok).toBe(true);
    if (second.ok) {
      releaseLevel3InflightLock(second.lock);
    }
  });

  it("lets admin code set and clear a local shadow ban", () => {
    const identityKey = "fp:1234567890abcdef";
    setShadowBanForIdentityKey(identityKey, 60_000);
    expect(isIdentityKeyShadowBanned(identityKey)).toBe(true);

    clearShadowBanForIdentityKey(identityKey);
    expect(isIdentityKeyShadowBanned(identityKey)).toBe(false);
  });
});
