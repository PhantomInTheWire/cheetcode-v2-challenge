import { describe, expect, it } from "vitest";
import {
  MAX_SESSION_PAUSE_EXTENSION_MS,
  clampSessionPauseExtension,
} from "../../convex/sessions";
import {
  PROBLEM_DISTRIBUTION,
  injectDescriptionCanary,
  selectSessionProblems,
  stripSolution,
} from "../../server/level1/problems";
import {
  LEVEL2_PROBLEM_SET_SIZE,
  LEVEL2_PROJECTS,
  LEVEL2_PROJECTS_PER_SESSION,
  LEVEL2_QUESTIONS_PER_PROJECT,
  selectLevel2SessionProblemsFromBank,
  selectLevel2SessionProblems,
} from "../../server/level2/problems";

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
    const projectCounts = selected.reduce(
      (acc, problem) => ({ ...acc, [problem.project]: (acc[problem.project] ?? 0) + 1 }),
      {} as Record<string, number>,
    );
    expect(Object.keys(projectCounts)).toHaveLength(LEVEL2_PROJECTS_PER_SESSION);
    expect(Object.values(projectCounts)).toEqual(
      Array(LEVEL2_PROJECTS_PER_SESSION).fill(LEVEL2_QUESTIONS_PER_PROJECT),
    );
  });

  it("throws when one project has fewer than the required 5 questions", () => {
    const bank = LEVEL2_PROJECTS.flatMap((project) => {
      const count = project === "chromium" ? LEVEL2_QUESTIONS_PER_PROJECT - 1 : 10;
      return Array.from({ length: count }, (_, idx) => ({
        id: `${project}_${idx}`,
        project,
        question: `q-${project}-${idx}`,
        answer: `a-${project}-${idx}`,
      }));
    });

    expect(() => selectLevel2SessionProblemsFromBank(bank)).toThrow(
      "insufficient level2 problems for project 'chromium'",
    );
  });

  it("honors an explicitly requested level 2 project pair", () => {
    const bank = LEVEL2_PROJECTS.flatMap((project) =>
      Array.from({ length: 10 }, (_, idx) => ({
        id: `${project}_${idx}`,
        project,
        question: `q-${project}-${idx}`,
        answer: `a-${project}-${idx}`,
      })),
    );
    const selected = selectLevel2SessionProblemsFromBank(bank, ["firefox", "postgres"]);

    const projects = new Set(selected.map((problem) => problem.project));
    expect(projects).toEqual(new Set(["firefox", "postgres"]));
  });

  it("caps session pause extensions to preserve timer integrity", () => {
    expect(clampSessionPauseExtension(-500)).toBe(0);
    expect(clampSessionPauseExtension(12_345.9)).toBe(12_345);
    expect(clampSessionPauseExtension(MAX_SESSION_PAUSE_EXTENSION_MS + 10_000)).toBe(
      MAX_SESSION_PAUSE_EXTENSION_MS,
    );
  });
});
