import { describe, expect, it } from "vitest";
import { getIdentityKeys, TRUSTED_FINGERPRINT_HEADER } from "../../src/lib/abuse/identity";

describe("abuse identity fingerprint contract", () => {
  it("captures both IP and trusted fingerprint identity keys for browser requests", () => {
    const request = new Request("http://localhost/api/level-3/validate", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        [TRUSTED_FINGERPRINT_HEADER]: "srvfp-browser-visitor-1234",
      },
    });

    const keys = getIdentityKeys(request);
    expect(keys.some((key) => key.startsWith("ip:"))).toBe(true);
    expect(keys.some((key) => key.startsWith("fp:"))).toBe(true);
  });

  it("ignores raw client fingerprint headers when no trusted fingerprint is present", () => {
    const request = new Request("http://localhost/api/level-3/validate", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        "x-client-fingerprint": "fp-client-visitor-1234",
      },
    });

    const keys = getIdentityKeys(request);
    expect(keys.some((key) => key.startsWith("fp:"))).toBe(false);
    expect(keys).toHaveLength(1);
  });

  it("uses the left-most forwarded IP as the client IP", () => {
    const request = new Request("http://localhost/api/level-3/validate", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.20, 192.0.2.30",
      },
    });

    const directRequest = new Request("http://localhost/api/level-3/validate", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(getIdentityKeys(request)).toEqual(getIdentityKeys(directRequest));
  });
});
