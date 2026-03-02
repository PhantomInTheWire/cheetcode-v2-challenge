import { describe, expect, it } from "vitest";
import { computeElo, getDifficultyBonus } from "../src/lib/scoring";

describe("scoring", () => {
  it("elo formula matches spec", () => {
    expect(computeElo({ solvedCount: 3, timeRemainingSecs: 10, difficultyBonus: 250 })).toBe(750);
  });

  it("time bonus only applies when solvedCount > 0", () => {
    expect(computeElo({ solvedCount: 0, timeRemainingSecs: 45, difficultyBonus: 0 })).toBe(0);
    expect(computeElo({ solvedCount: 1, timeRemainingSecs: 45, difficultyBonus: 0 })).toBe(1000);
  });

  it("faster 10/10 scores higher", () => {
    const slow = computeElo({ solvedCount: 10, timeRemainingSecs: 15, difficultyBonus: 450 });
    const fast = computeElo({ solvedCount: 10, timeRemainingSecs: 30, difficultyBonus: 450 });
    expect(fast).toBeGreaterThan(slow);
  });

  it("difficulty bonus sums only solved submissions", () => {
    const bonus = getDifficultyBonus([
      { solved: true, difficulty: "easy" },
      { solved: true, difficulty: "medium" },
      { solved: true, difficulty: "hard" },
      { solved: true, difficulty: "competitive" },
      { solved: false, difficulty: "competitive" },
    ]);
    expect(bonus).toBe(300);
  });
});
