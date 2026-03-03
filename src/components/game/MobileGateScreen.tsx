"use client";

import { LeaderboardTable } from "@/components/LeaderboardTable";

export function MobileGateScreen({
  leaderboard,
  totalSolveTarget,
  displayedSolveTarget,
}: {
  leaderboard: Array<{ github: string; elo: number; solved: number; timeSecs: number }>;
  totalSolveTarget: number;
  displayedSolveTarget: number;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: "60px 24px",
        fontFamily: "var(--font-geist-mono), monospace",
        textAlign: "center",
      }}
    >
      <span style={{ fontSize: 48, marginBottom: 20 }}>🔥</span>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fa5d19", margin: "0 0 12px" }}>
        FIRECRAWL CTF
      </h1>
      <p style={{ fontSize: 22, fontWeight: 700, color: "#262626", margin: "0 0 8px" }}>
        Play on your computer
      </p>
      <p style={{ fontSize: 14, color: "rgba(0,0,0,0.45)", maxWidth: 360, margin: "0 0 36px" }}>
        This challenge requires a full-sized screen. Open it on your desktop or laptop to play.
      </p>

      <LeaderboardTable
        rows={leaderboard}
        totalSolveTarget={totalSolveTarget}
        displayedSolveTarget={displayedSolveTarget}
      />
    </div>
  );
}
