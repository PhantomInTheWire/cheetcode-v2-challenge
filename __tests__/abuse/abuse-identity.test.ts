import { describe, expect, it } from "vitest";
import { getIdentityKeys, TRUSTED_FINGERPRINT_HEADER } from "../../src/lib/abuse/identity";
import { CLIENT_FINGERPRINT_HEADER } from "../../src/lib/fingerprint/fingerprint-contract";

describe("abuse identity fingerprint contract", () => {
  it("captures both IP and fingerprint identity keys for browser requests", () => {
    const request = new Request("http://localhost/api/validate-l3", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        [CLIENT_FINGERPRINT_HEADER]: "fp-browser-visitor-1234",
      },
    });

    const keys = getIdentityKeys(request);
    expect(keys.some((key) => key.startsWith("ip:"))).toBe(true);
    expect(keys.some((key) => key.startsWith("fp:"))).toBe(true);
  });

  it("prefers the trusted proxy fingerprint over the raw client header", () => {
    const request = new Request("http://localhost/api/validate-l3", {
      headers: {
        "x-forwarded-for": "203.0.113.10",
        [CLIENT_FINGERPRINT_HEADER]: "fp-client-visitor-1234",
        [TRUSTED_FINGERPRINT_HEADER]: "fp-proxy-promoted-5678",
      },
    });

    const keys = getIdentityKeys(request);
    expect(keys.some((key) => key.startsWith("fp:"))).toBe(true);
    expect(keys).toHaveLength(2);
  });
});
