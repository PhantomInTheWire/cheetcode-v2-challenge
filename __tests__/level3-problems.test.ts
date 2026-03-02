import { describe, expect, it } from "vitest";
import { generateLevel3Challenge, getLevel3ChallengeFromId } from "../server/level3/problems";

describe("level3 challenge templates", () => {
  it("loads spec/starter from asset files with assembler ABI requirement", () => {
    const challenge = generateLevel3Challenge();
    expect(challenge.spec).toContain("cpu_assemble");
    expect(challenge.spec).toContain("main.");
    expect(challenge.starterCode).toContain("cpu_assemble");
  });

  it("reconstructs challenge by id", () => {
    const challenge = generateLevel3Challenge();
    const rebuilt = getLevel3ChallengeFromId(challenge.id);
    expect(rebuilt).not.toBeNull();
    expect(rebuilt?.id).toBe(challenge.id);
    expect(rebuilt?.checks.length).toBe(challenge.checks.length);
  });
});
