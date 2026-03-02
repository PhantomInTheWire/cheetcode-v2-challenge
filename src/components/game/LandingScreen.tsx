"use client";

import { signIn, signOut } from "next-auth/react";
import Image from "next/image";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { COLORS } from "@/lib/theme";
import {
  ROUND_DURATION_SECONDS,
  PROBLEMS_PER_SESSION,
  SITE_URL,
} from "@/lib/constants";

type LandingScreenProps = {
  isAuthenticated: boolean;
  github: string;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  authSession: any;
  showLeaderboard: boolean;
  setShowLeaderboard: (v: boolean | ((prev: boolean) => boolean)) => void;
  unlockedLevel: number;
  isLocalDev: boolean;
  startGame: (level?: number) => void;
  leaderboard: any[];
  TOTAL_SOLVE_TARGET: number;
  displayedSolveTarget: number;
  submitError: string | null;
};

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
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: COLORS.BG_PAGE,
        padding: "80px 24px",
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
      <div style={{ width: "100%", maxWidth: 600, textAlign: "center" }}>
        {/* Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 40 }}>🔥</span>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: COLORS.PRIMARY,
                margin: 0,
                letterSpacing: -1,
              }}
            >
              FIRECRAWL CTF
            </h1>
          </div>
          <a
            href={SITE_URL}
            style={{
              fontSize: 12,
              color: COLORS.TEXT_MUTED,
              marginTop: 6,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            cheetcode-ctf.firecrawl.dev
          </a>
        </div>

        {/* Headline card */}
        <div
          style={{
            background: COLORS.BG_CARD,
            border: `1px solid ${COLORS.BORDER_LIGHT}`,
            borderRadius: 16,
            padding: "48px 40px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <p
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: COLORS.TEXT_DARK,
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: -0.5,
            }}
          >
            {PROBLEMS_PER_SESSION} problems. {ROUND_DURATION_SECONDS} seconds.
          </p>
          <p
            style={{
              fontSize: 16,
              color: COLORS.TEXT_MUTED,
              margin: "12px 0 0",
              fontWeight: 400,
            }}
          >
            Good luck.
          </p>
        </div>

        {/* Info chips */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 10,
            marginTop: 28,
          }}
        >
          {[
            `Solve all ${PROBLEMS_PER_SESSION} coding challenges`,
            `You have ${ROUND_DURATION_SECONDS} seconds`,
            `That's ${(ROUND_DURATION_SECONDS / PROBLEMS_PER_SESSION).toFixed(1)} seconds per problem`,
          ].map((t) => (
            <span
              key={t}
              style={{
                background: COLORS.BG_CARD,
                border: `1px solid ${COLORS.BORDER_LIGHT}`,
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                color: COLORS.TEXT_MUTED,
              }}
            >
              {t}
            </span>
          ))}
        </div>

        {/* Auth + Start card */}
        <div
          style={{
            maxWidth: 420,
            margin: "36px auto 0",
            background: COLORS.BG_CARD,
            border: `1px solid ${COLORS.BORDER_LIGHT}`,
            borderRadius: 16,
            padding: "28px 32px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          {authStatus === "loading" && (
            <p style={{ fontSize: 13, color: COLORS.TEXT_MUTED, textAlign: "center" }}>
              Loading...
            </p>
          )}

          {authStatus === "unauthenticated" && (
            <>
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: COLORS.TEXT_MUTED,
                  marginBottom: 12,
                  textAlign: "center",
                }}
              >
                Sign in to play — your GitHub identity is your scoreboard entry
              </p>
              <button
                onClick={() => signIn("github")}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  background: "#24292f",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#1b1f23")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#24292f")}
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                Sign in with GitHub
              </button>
            </>
          )}

          {isAuthenticated && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {authSession.user.image && (
                    <Image
                      src={authSession.user.image}
                      alt=""
                      width={32}
                      height={32}
                      style={{ borderRadius: "50%", border: `1px solid ${COLORS.BORDER_LIGHT}` }}
                    />
                  )}
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: COLORS.TEXT_DARK, margin: 0 }}>
                      @{github}
                    </p>
                    <p style={{ fontSize: 11, color: COLORS.TEXT_MUTED, margin: 0 }}>
                      Verified via GitHub OAuth
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => signOut()}
                  style={{
                    fontSize: 11,
                    color: COLORS.TEXT_MUTED,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontFamily: "inherit",
                  }}
                >
                  sign out
                </button>
              </div>
              {/* Error display */}
              {submitError && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "12px 16px",
                    background: COLORS.ERROR_LIGHT,
                    border: `1px solid ${COLORS.ERROR}`,
                    borderRadius: 12,
                    color: COLORS.ERROR,
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "center",
                  }}
                >
                  {submitError}
                </div>
              )}
              {/* Level selection */}
              {unlockedLevel < 2 && !isLocalDev ? (
                <button
                  onClick={() => startGame(1)}
                  className="btn-heat"
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 12,
                    fontSize: 17,
                    fontWeight: 800,
                    letterSpacing: 2,
                    fontFamily: "inherit",
                  }}
                >
                  START
                </button>
              ) : unlockedLevel < 3 && !isLocalDev ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => startGame(1)}
                    className="btn-heat"
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 12,
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    PLAY LEVEL 1
                  </button>
                  <button
                    onClick={() => startGame(2)}
                    className="btn-heat"
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 12,
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    PLAY LEVEL 2
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => startGame(1)}
                    className="btn-heat"
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 12,
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    PLAY LEVEL 1
                  </button>
                  <button
                    onClick={() => startGame(2)}
                    className="btn-heat"
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 12,
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    PLAY LEVEL 2
                  </button>
                  <button
                    onClick={() => startGame(3)}
                    className="btn-heat"
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 12,
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    PLAY LEVEL 3
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Leaderboard toggle */}
        <button
          onClick={() => setShowLeaderboard((c) => !c)}
          style={{
            display: "block",
            margin: "28px auto 0",
            background: "none",
            border: "none",
            color: COLORS.TEXT_MUTED,
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            textUnderlineOffset: 4,
            fontFamily: "inherit",
          }}
        >
          {showLeaderboard ? "hide leaderboard" : "view leaderboard"}
        </button>

        {showLeaderboard && (
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
            <LeaderboardTable
              rows={leaderboard}
              totalSolveTarget={TOTAL_SOLVE_TARGET}
              displayedSolveTarget={displayedSolveTarget}
            />
          </div>
        )}
      </div>
    </div>
  );
}
