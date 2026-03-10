"use client";

import { signIn, signOut } from "next-auth/react";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { BrailleSpinner, AnimatedLandingDecor } from "@/components/game/decor";
import { IdentityPill } from "@/components/shared/IdentityPill";
import {
  ROUND_DURATION_SECONDS,
  PROBLEMS_PER_SESSION,
  SITE_URL,
  LEVEL2_TOTAL,
  LEVEL3_TOTAL,
} from "@/lib/constants";

type LandingScreenProps = {
  isAuthenticated: boolean;
  github: string;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  authSession: { user?: { image?: string | null } } | null;
  showLeaderboard: boolean;
  setShowLeaderboard: (v: boolean | ((prev: boolean) => boolean)) => void;
  unlockedLevel: number;
  isLocalDev: boolean;
  startGame: (level?: number) => void;
  leaderboard: Array<{ github: string; elo: number; solved: number; timeSecs: number }>;
  TOTAL_SOLVE_TARGET: number;
  displayedSolveTarget: number;
  submitError: string | null;
};

// ── Exact Firecrawl button shadow (from computed styles on firecrawl.dev) ──

const HEAT_SHADOW = `
  inset 0px -6px 12px 0px rgba(250,25,25,0.2),
  0px 2px 4px 0px rgba(250,93,25,0.12),
  0px 1px 1px 0px rgba(250,93,25,0.12),
  0px 0.5px 0.5px 0px rgba(250,93,25,0.16),
  0px 0.25px 0.25px 0px rgba(250,93,25,0.2)
`;

const HEAT_SHADOW_HOVER = `
  inset 0px -6px 12px 0px rgba(250,25,25,0.2),
  0px 4px 8px 0px rgba(250,93,25,0.18),
  0px 2px 2px 0px rgba(250,93,25,0.14),
  0px 1px 1px 0px rgba(250,93,25,0.18),
  0px 0.5px 0.5px 0px rgba(250,93,25,0.22)
`;

export function LandingScreen({
  isAuthenticated,
  github,
  authStatus,
  authSession,
  showLeaderboard,
  setShowLeaderboard,
  unlockedLevel,
  isLocalDev,
  startGame,
  leaderboard,
  TOTAL_SOLVE_TARGET,
  displayedSolveTarget,
  submitError,
}: LandingScreenProps) {
  const totalSeconds = ROUND_DURATION_SECONDS + 60 + 120;
  const totalTasks = PROBLEMS_PER_SESSION + LEVEL2_TOTAL + LEVEL3_TOTAL;
  const secsPerTask = Math.floor(totalSeconds / totalTasks);
  const totalTimeLabel = `${totalSeconds} secs`;
  const availableLevels =
    unlockedLevel < 2 && !isLocalDev ? [1] : unlockedLevel < 3 && !isLocalDev ? [1, 2] : [1, 2, 3];

  const levelMeta: Record<number, { desc: string; time: string }> = {
    1: { desc: "Orchestrate", time: `${ROUND_DURATION_SECONDS}s` },
    2: { desc: "Explore", time: "60s" },
    3: { desc: "Build", time: "120s" },
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "#f9f9f9",
        color: "#262626",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Background: grid + radial gradient (firecrawl dashboard bg) ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.5,
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
            radial-gradient(ellipse at top left, rgba(250,93,25,0.05) 0%, transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(250,93,25,0.03) 0%, transparent 50%)
          `,
        }}
      />

      {/* ── Main content ─────────────────────────────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
          overflow: "hidden",
        }}
      >
        {/* ── Firecrawl-style decorative labels ── */}
        {[
          { text: "[ CTF ]", top: 32, left: 24 },
          { text: "[ ALGO ]", bottom: 32, left: 24 },
          { text: "[ 240s ]", top: 32, right: 24 },
          { text: "[ START ]", bottom: 32, right: 24 },
        ].map((label, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: label.top,
              bottom: label.bottom,
              left: label.left,
              right: label.right,
              fontSize: 12,
              fontFamily: "var(--font-geist-mono), monospace",
              color: "rgba(0,0,0,0.12)",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 2,
              width: 102,
              textAlign: "center",
            }}
          >
            {label.text}
          </div>
        ))}

        <AnimatedLandingDecor />
        <div
          style={{
            width: "100%",
            maxWidth: 640,
            textAlign: "center",
            opacity: 0,
            transform: "translateY(12px)",
            animation: "landing-screen-enter 0.5s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
          }}
        >
          {/* ── Logo ───────────────────────────────────────────── */}
          <div style={{ marginBottom: 32 }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 600 600"
                preserveAspectRatio="xMidYMid meet"
                style={{ display: "inline-block", verticalAlign: "middle" }}
                dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 450,
                  color: "#262626",
                  letterSpacing: 0.5,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                Firecrawl CTF
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(0,0,0,0.16)",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                ·
              </span>
              <a
                href={SITE_URL}
                style={{
                  fontSize: 12,
                  color: "rgba(0,0,0,0.3)",
                  textDecoration: "none",
                  fontWeight: 400,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                {SITE_URL.replace(/^https?:\/\//, "")}
              </a>
            </div>
          </div>

          {/* ── Hero heading — firecrawl.dev style ─────────────── */}
          <h1
            style={{
              fontSize: 52,
              fontWeight: 500,
              lineHeight: "56px",
              letterSpacing: -0.52,
              color: "#262626",
              margin: 0,
              fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            }}
          >
            3 levels. <span style={{ color: "#fa5d19" }}>{totalTimeLabel}.</span>
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: "24px",
              color: "rgba(0,0,0,0.5)",
              margin: "12px 0 0",
              fontWeight: 400,
              fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            }}
          >
            Orchestrate, Explore and Build systems.
          </p>

          {/* ── Stats row ──────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 24,
              marginTop: 24,
              fontSize: 12,
              color: "rgba(0,0,0,0.16)",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            <span>
              [ <span style={{ color: "#fa5d19" }}>{totalTasks}</span> tasks ]
            </span>
            <span>
              [ <span style={{ color: "#fa5d19" }}>{totalSeconds}</span> secs ]
            </span>
            <span>
              [ <span style={{ color: "#fa5d19" }}>{secsPerTask}</span> sec/task ]
            </span>
          </div>

          {/* ── Auth + Level select ────────────────────────────── */}
          <div style={{ marginTop: 40 }}>
            {authStatus === "loading" && (
              <p style={{ fontSize: 14, color: "rgba(0,0,0,0.35)", margin: 0 }}>
                <BrailleSpinner /> &nbsp;Loading...
              </p>
            )}

            {authStatus === "unauthenticated" && (
              <div style={{ maxWidth: 380, margin: "0 auto" }}>
                <p
                  style={{
                    fontSize: 13,
                    color: "rgba(0,0,0,0.4)",
                    marginBottom: 16,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  Sign in to play — your GitHub identity is your scoreboard entry.
                </p>
                <button
                  onClick={() => signIn("github")}
                  style={{
                    width: "100%",
                    height: 40,
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 450,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    background: "#24292f",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1b1f23")}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#24292f";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.995)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  Sign in with GitHub
                </button>
              </div>
            )}

            {isAuthenticated && (
              <>
                {/* User pill + sign out */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginBottom: 24,
                  }}
                >
                  <IdentityPill github={github} image={authSession?.user?.image} />
                  <button
                    onClick={() => signOut()}
                    style={{
                      fontSize: 13,
                      fontWeight: 450,
                      color: "rgba(0,0,0,0.3)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      padding: "4px 8px",
                      borderRadius: 8,
                      transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "rgba(0,0,0,0.6)";
                      e.currentTarget.style.background = "rgba(0,0,0,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "rgba(0,0,0,0.3)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Sign out
                  </button>
                </div>

                {/* Error */}
                {submitError && (
                  <div
                    style={{
                      maxWidth: 480,
                      margin: "0 auto 16px",
                      padding: "8px 16px",
                      background: "rgba(235,52,36,0.05)",
                      border: "1px solid rgba(235,52,36,0.12)",
                      borderRadius: 10,
                      color: "#eb3424",
                      fontSize: 13,
                      fontWeight: 450,
                      textAlign: "center",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    {submitError}
                  </div>
                )}

                {/* Level buttons */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {availableLevels.map((level) => {
                    const meta = levelMeta[level] || { desc: `L${level}`, time: "" };
                    const isFirst = level === Math.min(...availableLevels);

                    return (
                      <button
                        key={level}
                        onClick={() => startGame(level)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          height: 40,
                          minWidth: 150,
                          padding: "0 20px",
                          borderRadius: 10,
                          fontSize: 14,
                          fontWeight: 450,
                          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                          cursor: "pointer",
                          transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                          border: "none",
                          background: isFirst ? "#ff4c00" : "rgba(0,0,0,0.04)",
                          color: isFirst ? "#ffffff" : "#262626",
                          boxShadow: isFirst ? HEAT_SHADOW : "none",
                        }}
                        onMouseEnter={(e) => {
                          if (isFirst) {
                            e.currentTarget.style.boxShadow = HEAT_SHADOW_HOVER;
                          } else {
                            e.currentTarget.style.background = "rgba(0,0,0,0.06)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "scale(1)";
                          if (isFirst) {
                            e.currentTarget.style.boxShadow = HEAT_SHADOW;
                          } else {
                            e.currentTarget.style.background = "rgba(0,0,0,0.04)";
                          }
                        }}
                        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.995)")}
                        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                      >
                        <span
                          style={{
                            opacity: isFirst ? 0.8 : 0.4,
                            fontSize: 11,
                            fontWeight: 450,
                            fontFamily: "var(--font-geist-mono), monospace",
                          }}
                        >
                          L{level}
                        </span>
                        <span>{meta.desc}</span>
                        <span
                          style={{
                            fontSize: 11,
                            opacity: isFirst ? 0.7 : 0.35,
                            fontVariantNumeric: "tabular-nums",
                            fontFamily: "var(--font-geist-mono), monospace",
                          }}
                        >
                          {meta.time}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* ── Leaderboard ─────────────────────────────────────── */}
          <div style={{ marginTop: 32 }}>
            <button
              onClick={() => setShowLeaderboard((c: boolean) => !c)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(0,0,0,0.04)",
                border: "none",
                color: "#262626",
                fontSize: 14,
                fontWeight: 450,
                cursor: "pointer",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                padding: "8px 16px",
                borderRadius: 10,
                height: 36,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0,0,0,0.04)";
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.5 }}
              >
                <path d="M12 20V10" />
                <path d="M18 20V4" />
                <path d="M6 20v-4" />
              </svg>
              {showLeaderboard ? "Hide leaderboard" : "Leaderboard"}
            </button>
          </div>

          {showLeaderboard && (
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
              <LeaderboardTable
                rows={leaderboard}
                totalSolveTarget={TOTAL_SOLVE_TARGET}
                displayedSolveTarget={displayedSolveTarget}
              />
            </div>
          )}
        </div>

        <style jsx>{`
          @keyframes landing-screen-enter {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </div>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "rgba(0,0,0,0.16)",
          fontFamily: "var(--font-geist-mono), monospace",
          zIndex: 10,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <span>firecrawl</span>
        <span>·</span>
        <span>cheetcode ctf</span>
        <span>·</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>v2.0</span>
      </div>
    </div>
  );
}
