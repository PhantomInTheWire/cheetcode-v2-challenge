/**
 * Shared utility functions for Convex functions
 */

import type { Doc } from "./_generated/dataModel";

/**
 * Sort leaderboard entries by ELO (descending) and attempts (ascending)
 * Primary sort: ELO (higher is better)
 * Tie-breaker: attempts (fewer is better)
 */
export function sortByEloAndAttempts(
  entries: Doc<"leaderboard">[],
): Doc<"leaderboard">[] {
  return [...entries].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return (a.attempts ?? 1) - (b.attempts ?? 1);
  });
}

/**
 * Calculate rank based on ELO and attempts
 * Returns the position in the leaderboard (1-indexed)
 */
export function calculateRank(
  sortedEntries: Doc<"leaderboard">[],
  targetElo: number,
  targetAttempts: number,
): number {
  const index = sortedEntries.findIndex(
    (row) =>
      row.elo < targetElo ||
      (row.elo === targetElo && (row.attempts ?? 1) > targetAttempts),
  );
  return index === -1 ? sortedEntries.length + 1 : index + 1;
}