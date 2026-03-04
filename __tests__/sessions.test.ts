import { describe, expect, it } from "vitest";
import {
  PROBLEM_DISTRIBUTION,
  injectDescriptionCanary,
  selectSessionProblems,
  stripSolution,
} from "../server/level1/problems";
import {
  LEVEL2_PROBLEM_SET_SIZE,
  selectLevel2SessionProblems,
} from "../server/level2/problems";

describe("sessions", () => {
  it("selects the configured number of level 1 problems by tier", () => {
    const selected = selectSessionProblems();
    expect(selected).toHaveLength(
      PROBLEM_DISTRIBUTION.easy +
        PROBLEM_DISTRIBUTION.medium +
        PROBLEM_DISTRIBUTION.hard +
        PROBLEM_DISTRIBUTION.competitive,
    );

    const counts = selected.reduce(
      (acc, problem) => ({ ...acc, [problem.tier]: acc[problem.tier] + 1 }),
      { easy: 0, medium: 0, hard: 0, competitive: 0 },
    );
    expect(counts).toEqual(PROBLEM_DISTRIBUTION);
  });

  it("does not duplicate problems in one selected session set", () => {
    const selected = selectSessionProblems();
    expect(new Set(selected.map((problem) => problem.id)).size).toBe(selected.length);
  });

  it("stripSolution removes solution but keeps test cases", () => {
    const selected = selectSessionProblems();
    const stripped = stripSolution(selected[0]);
    expect("solution" in stripped).toBe(false);
    expect(stripped.testCases.length).toBeGreaterThan(0);
  });

  it("injectDescriptionCanary mutates exactly one problem description", () => {
    const selected = selectSessionProblems().slice(0, 5).map(stripSolution);
    const injected = injectDescriptionCanary(selected);
    const mutatedCount = injected.filter(
      (p, idx) => p.description !== selected[idx].description,
    ).length;
    expect(mutatedCount).toBe(1);
  });

  it("selects exactly 10 unique level 2 problems per session", () => {
    const selected = selectLevel2SessionProblems();
    expect(selected).toHaveLength(LEVEL2_PROBLEM_SET_SIZE);
    expect(new Set(selected.map((problem) => problem.id)).size).toBe(selected.length);
  });
});
