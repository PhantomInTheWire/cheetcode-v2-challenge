import type { Doc } from "./_generated/dataModel";

export function sortByEloAndAttempts(entries: Doc<"leaderboard">[]): Doc<"leaderboard">[] {
  return [...entries].sort((a, b) => {
    if (b.elo !== a.elo) return b.elo - a.elo;
    return (a.attempts ?? 1) - (b.attempts ?? 1);
  });
}

export function calculateRank(
  sortedEntries: Doc<"leaderboard">[],
  targetElo: number,
  targetAttempts: number,
): number {
  const betterCount = sortedEntries.filter(
    (row) => row.elo > targetElo || (row.elo === targetElo && (row.attempts ?? 1) < targetAttempts),
  ).length;
  return betterCount + 1;
}
