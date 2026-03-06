"use client";

import { LeaderboardTable } from "@/components/LeaderboardTable";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { AnimatedLandingDecor } from "./decor";

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

      <AnimatedLandingDecor />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 600 }}>
        <div style={{ marginBottom: 20 }}>
          <svg
            width="48"
            height="48"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block" }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
        </div>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: "#262626",
            margin: "0 0 8px",
            letterSpacing: -0.5,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Firecrawl CTF
        </h1>
        <p
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: "#262626",
            margin: "0 0 12px",
            letterSpacing: -0.3,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Desktop Required
        </p>
        <p
          style={{
            fontSize: 15,
            color: "rgba(0,0,0,0.4)",
            maxWidth: 400,
            margin: "0 auto 40px",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            lineHeight: 1.6,
          }}
        >
          This challenge requires a full-sized screen. Open it on your desktop or laptop to
          participate.
        </p>

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e8e8e8",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 4px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
            textAlign: "left",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "rgba(0,0,0,0.3)",
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            [ Leaderboard ] Global Rankings
          </div>
          <LeaderboardTable
            rows={leaderboard}
            totalSolveTarget={totalSolveTarget}
            displayedSolveTarget={displayedSolveTarget}
          />
        </div>
      </div>
    </div>
  );
}
