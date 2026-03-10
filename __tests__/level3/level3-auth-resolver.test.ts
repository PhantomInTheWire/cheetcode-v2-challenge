import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getLevel3ChallengeFromId } from "../../server/level3/problems";

function readSpec(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "server/level3/tasks/identity-bundle-auth-resolver/spec.md"),
    "utf8",
  );
}

describe("identity bundle auth resolver task", () => {
  it("spec declares the public API and core semantics", () => {
    const spec = readSpec();

    const requiredApi = [
      "auth_reset",
      "auth_create_local_grant",
      "auth_import_bundle_grant",
      "auth_attach_bundle_key",
      "auth_delegate",
      "auth_revoke",
      "auth_check",
      "auth_effective_mask",
      "auth_audit_get",
      "auth_count_usable",
      "auth_last_error",
      "AuthAuditView",
    ];

    for (const symbol of requiredApi) {
      expect(spec).toContain(symbol);
    }

    expect(spec).toContain("Resolver Model");
    expect(spec).toContain("Delegation Semantics");
    expect(spec).toContain("Resolution Modes");
    expect(spec).toContain("Audit Contract");
    expect(spec).toContain("Error Reporting");
    expect(spec).toContain("large irrelevant populations");
  });

  it("exposes the expected language variants and generic visible check buckets", () => {
    const expectedVisibleNames = [
      "Behavior Bucket 1",
      "Behavior Bucket 2",
      "Behavior Bucket 3",
      "Behavior Bucket 4",
      "Update Bucket 1",
      "Update Bucket 2",
      "Update Bucket 3",
      "Update Bucket 4",
      "Scale Budget 1",
      "Scale Budget 2",
      "Scale Budget 3",
      "Scale Budget 4",
      "Scale Budget 5",
      "Scale Budget 6",
      "Scale Budget 7",
      "Scale Budget 8",
      "Scale Budget 9",
      "Scale Budget 10",
      "Scale Budget 11",
      "Scale Budget 12",
      "Scale Budget 13",
      "Scale Budget 14",
      "Scale Budget 15",
      "Scale Budget 16",
      "Scale Budget 17",
    ];

    for (const languageKey of ["c", "cpp", "rust"]) {
      const challenge = getLevel3ChallengeFromId(`l3:identity-bundle-auth-resolver:${languageKey}`);
      expect(challenge).not.toBeNull();
      expect(challenge?.checks).toHaveLength(25);
      expect(challenge?.starterCode).toContain("auth_reset");
      expect(challenge?.starterCode).toContain("auth_check");
      expect(challenge?.spec).toContain("AUTO");
      expect(challenge?.spec).toContain("IDENTITY_BUNDLE");
      expect(challenge?.checks.map((check) => check.name)).toEqual(expectedVisibleNames);
      expect(challenge?.checks.slice(0, 5).map((check) => check.name)).toEqual(
        expectedVisibleNames.slice(0, 5),
      );
    }
  });
});
