import { describe, expect, it } from "vitest";
import { PROBLEM_BANK } from "../server/problems";
import fs from "node:fs";

describe("problems", () => {
  it("exports problems in pool", () => {
    expect(PROBLEM_BANK.length).toBeGreaterThanOrEqual(90);
  });

  it("every problem has required fields", () => {
    for (const problem of PROBLEM_BANK) {
      expect(problem.id).toBeTruthy();
      expect(problem.title).toBeTruthy();
      expect(problem.description).toBeTruthy();
      expect(problem.signature).toBeTruthy();
      expect(problem.testCases.length).toBeGreaterThanOrEqual(3);
      expect(problem.solution).toBeTruthy();
      expect(["easy", "medium", "hard", "competitive"]).toContain(problem.tier);
    }
  });

  it("has no duplicate IDs", () => {
    const ids = PROBLEM_BANK.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every solution parses as valid JS", () => {
    for (const problem of PROBLEM_BANK) {
      expect(() => new Function(`${problem.solution};`)).not.toThrow();
    }
  });

  it("problem bank is not imported by client page", () => {
    // This asserts against a common accidental path.
    const pageSource = fs.readFileSync("src/app/page.tsx", "utf8");
    expect(pageSource.includes("server/problems")).toBe(false);
  });
});
