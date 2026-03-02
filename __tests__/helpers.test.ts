import { describe, expect, it } from "vitest";
import { sortByEloAndAttempts, calculateRank } from "../convex/helpers";
import type { Doc } from "../convex/_generated/dataModel";

// Minimal mock matching the Doc<"leaderboard"> shape used by helpers
function makeEntry(elo: number, attempts: number | undefined = undefined): Doc<"leaderboard"> {
  return {
    _id: "" as Doc<"leaderboard">["_id"],
    _creationTime: 0,
    github: `user-${elo}-${attempts ?? "x"}`,
    solved: 1,
    timeSecs: 60,
    elo,
    sessionId: "" as Doc<"leaderboard">["sessionId"],
    attempts,
  };
}

describe("sortByEloAndAttempts", () => {
  it("sorts by ELO descending", () => {
    const entries = [makeEntry(100), makeEntry(300), makeEntry(200)];
    const sorted = sortByEloAndAttempts(entries);
    expect(sorted.map((e) => e.elo)).toEqual([300, 200, 100]);
  });

  it("breaks ELO ties by attempts ascending", () => {
    const entries = [makeEntry(200, 5), makeEntry(200, 2), makeEntry(200, 3)];
    const sorted = sortByEloAndAttempts(entries);
    expect(sorted.map((e) => e.attempts)).toEqual([2, 3, 5]);
  });

  it("treats undefined attempts as 1", () => {
    const entries = [makeEntry(200, 3), makeEntry(200, undefined), makeEntry(200, 2)];
    const sorted = sortByEloAndAttempts(entries);
    // undefined → 1, so order: 1, 2, 3
    expect(sorted.map((e) => e.attempts)).toEqual([undefined, 2, 3]);
  });

  it("does not mutate the input array", () => {
    const entries = [makeEntry(100), makeEntry(300)];
    const original = [...entries];
    sortByEloAndAttempts(entries);
    expect(entries.map((e) => e.elo)).toEqual(original.map((e) => e.elo));
  });

  it("returns empty array when given empty array", () => {
    expect(sortByEloAndAttempts([])).toEqual([]);
  });
});

describe("calculateRank", () => {
  it("returns correct rank for highest ELO", () => {
    const sorted = [makeEntry(300), makeEntry(200), makeEntry(100)];
    expect(calculateRank(sorted, 300, 1)).toBe(1);
  });

  it("returns correct rank for middle ELO", () => {
    const sorted = [makeEntry(300), makeEntry(200), makeEntry(100)];
    expect(calculateRank(sorted, 200, 1)).toBe(2);
  });

  it("returns last+1 when ELO is lowest", () => {
    const sorted = [makeEntry(300), makeEntry(200), makeEntry(100)];
    expect(calculateRank(sorted, 50, 1)).toBe(4);
  });

  it("uses attempts as tiebreaker", () => {
    const sorted = [makeEntry(200, 1), makeEntry(200, 3), makeEntry(100)];
    // targetElo=200, targetAttempts=2: rank should be 2 (after entry with 1 attempt)
    expect(calculateRank(sorted, 200, 2)).toBe(2);
  });

  it("returns 1 for empty list", () => {
    expect(calculateRank([], 100, 1)).toBe(1);
  });
});
