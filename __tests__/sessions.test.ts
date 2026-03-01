import { beforeEach, describe, expect, it } from "vitest";
import { createSession, resetStore } from "../src/server/store";

describe("sessions", () => {
  beforeEach(() => {
    resetStore();
  });

  it("create returns sessionId + 10 problems", () => {
    const session = createSession("firecrawl");
    expect(session.sessionId).toBeTruthy();
    expect(session.problems).toHaveLength(10);
  });

  it("problems include testCases but not solutions", () => {
    const session = createSession("firecrawl");
    for (const problem of session.problems) {
      expect(problem.testCases.length).toBeGreaterThan(0);
      expect("solution" in problem).toBe(false);
    }
  });

  it("selection ratio is 5 easy, 3 medium, 2 hard", () => {
    const session = createSession("firecrawl");
    const counts = session.problems.reduce(
      (acc, problem) => ({ ...acc, [problem.difficulty]: acc[problem.difficulty] + 1 }),
      { easy: 0, medium: 0, hard: 0 },
    );
    expect(counts.easy).toBe(5);
    expect(counts.medium).toBe(3);
    expect(counts.hard).toBe(2);
  });

  it("no duplicates within a session", () => {
    const session = createSession("firecrawl");
    expect(new Set(session.problems.map((problem) => problem.id)).size).toBe(10);
  });

  it("two sessions can return different sets", () => {
    let different = false;
    for (let i = 0; i < 6; i += 1) {
      const a = createSession(`a-${i}`).problems.map((problem) => problem.id).join("|");
      const b = createSession(`b-${i}`).problems.map((problem) => problem.id).join("|");
      if (a !== b) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });

  it("expiresAt = startedAt + 60000", () => {
    const session = createSession("firecrawl");
    expect(session.expiresAt - session.startedAt).toBe(60_000);
  });

  it("create without github throws", () => {
    expect(() => createSession("")).toThrow();
  });
});
