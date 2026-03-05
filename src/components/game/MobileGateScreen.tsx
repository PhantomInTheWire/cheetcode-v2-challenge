"use client";

import { LeaderboardTable } from "@/components/LeaderboardTable";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";

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
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Grid background ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.4,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "8px 8px",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse at top left, rgba(250,93,25,0.04) 0%, transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(250,93,25,0.02) 0%, transparent 50%)
          `,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ marginBottom: 16 }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block" }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
        </div>
        <h1
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: "#262626",
            margin: "0 0 8px",
            letterSpacing: -0.3,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Firecrawl CTF
        </h1>
        <p
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "#262626",
            margin: "0 0 8px",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Play on your computer
        </p>
        <p
          style={{
            fontSize: 14,
            color: "rgba(0,0,0,0.4)",
            maxWidth: 360,
            margin: "0 auto 36px",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            lineHeight: 1.6,
          }}
        >
          This challenge requires a full-sized screen. Open it on your desktop or laptop to play.
        </p>

        <LeaderboardTable
          rows={leaderboard}
          totalSolveTarget={totalSolveTarget}
          displayedSolveTarget={displayedSolveTarget}
        />
      </div>
    </div>
  );
}
