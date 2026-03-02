import { describe, expect, it } from "vitest";
import { generateLevel3Challenge, getLevel3ChallengeFromId } from "../server/level3/problems";

describe("level3 challenge templates", () => {
  it("loads non-empty spec and starter templates", () => {
    const challenge = generateLevel3Challenge();
    expect(challenge.spec.trim().length).toBeGreaterThan(200);
    expect(challenge.starterCode.trim().length).toBeGreaterThan(200);
  });

  it("includes expected language variants", () => {
    for (const key of ["c", "cpp", "rust"]) {
      const challenge = getLevel3ChallengeFromId(`l3:cpu-16bit-emulator:${key}`);
      expect(challenge).not.toBeNull();
      expect(challenge?.language).toBe(key === "c" ? "C" : key === "cpp" ? "C++" : "Rust");
    }
  });

  it("reconstructs challenge by id", () => {
    const challenge = generateLevel3Challenge();
    const rebuilt = getLevel3ChallengeFromId(challenge.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.id).toBe(challenge.id);
    expect(rebuilt?.checks.length).toBe(challenge.checks.length);
  });

  it("defines exactly 20 score-bearing checks", () => {
    const challenge = getLevel3ChallengeFromId("l3:cpu-16bit-emulator:c");
    expect(challenge).not.toBeNull();
    expect(challenge?.checks).toHaveLength(20);
  });
});
