import { describe, expect, it } from "vitest";
import { generateLevel3Challenge, getLevel3ChallengeFromId } from "../server/level3/problems";
import { LEVEL3_ENABLED_TASKS } from "../server/level3/taskCatalog";
import { LEVEL3_TOTAL } from "../src/lib/constants";

describe("level3 challenge templates", () => {
  it("loads non-empty spec and starter templates", () => {
    const challenge = generateLevel3Challenge();
    expect(challenge.spec.trim().length).toBeGreaterThan(200);
    const exportNames = [...new Set(challenge.checks.map((check) => check.exportName))];
    for (const exportName of exportNames) {
      expect(challenge.starterCode).toContain(exportName);
      expect(challenge.spec).toContain(exportName);
    }
    expect(challenge.starterCode.trim().length).toBeLessThan(4000);
  });

  it("includes expected language variants", () => {
    for (const task of LEVEL3_ENABLED_TASKS) {
      for (const key of ["c", "cpp", "rust"]) {
        const challenge = getLevel3ChallengeFromId(`l3:${task.id}:${key}`);
        if (!task.languages.includes(key === "c" ? "C" : key === "cpp" ? "C++" : "Rust")) {
          expect(challenge).toBeNull();
          continue;
        }
        expect(challenge).not.toBeNull();
        expect(challenge?.language).toBe(key === "c" ? "C" : key === "cpp" ? "C++" : "Rust");
      }
    }
  });

  it("reconstructs challenge by id", () => {
    const challenge = generateLevel3Challenge();
    const rebuilt = getLevel3ChallengeFromId(challenge.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.id).toBe(challenge.id);
    expect(rebuilt?.checks.length).toBe(challenge.checks.length);
  });

  it("defines exactly LEVEL3_TOTAL score-bearing checks", () => {
    for (const task of LEVEL3_ENABLED_TASKS) {
      const challenge = getLevel3ChallengeFromId(`l3:${task.id}:c`);
      expect(challenge).not.toBeNull();
      expect(challenge?.checks).toHaveLength(LEVEL3_TOTAL);
    }
  });
});
