import { describe, expect, it } from "vitest";
import { LEVEL2_PROBLEMS } from "../server/level2/problems";

describe("level2 questions json", () => {
  it("loads at least one question", () => {
    expect(LEVEL2_PROBLEMS.length).toBeGreaterThan(0);
  });

  it("has valid required fields", () => {
    for (const problem of LEVEL2_PROBLEMS) {
      expect(typeof problem.id).toBe("string");
      expect(problem.id.trim().length).toBeGreaterThan(0);

      expect(typeof problem.question).toBe("string");
      expect(problem.question.trim().length).toBeGreaterThan(0);

      expect(typeof problem.answer).toBe("string");
      expect(problem.answer.trim().length).toBeGreaterThan(0);

      if (problem.acceptableAnswers !== undefined) {
        expect(Array.isArray(problem.acceptableAnswers)).toBe(true);
        expect(problem.acceptableAnswers.every((value) => typeof value === "string")).toBe(true);
      }
    }
  });

  it("has unique ids", () => {
    const ids = LEVEL2_PROBLEMS.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps a stable shape for the first item", () => {
    const first = LEVEL2_PROBLEMS[0];
    expect(first).toMatchObject({
      id: expect.any(String),
      question: expect.any(String),
      answer: expect.any(String),
    });
  });
});
