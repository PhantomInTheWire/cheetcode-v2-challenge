"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { TOTAL_SOLVE_TARGET } from "@/lib/config/constants";
import {
  RESULTS_FIELD_LABEL_STYLE,
  RESULTS_INPUT_STYLE,
  RESULTS_LAYOUT,
  ResultsBackdrop,
  ResultsHero,
  ResultsPanel,
  ResultsStatsGrid,
} from "@/components/game/results/results-shared";

const VictoryScreen = dynamic(() =>
  import("@/components/game/results/VictoryScreen").then((mod) => mod.VictoryScreen),
);

type ResultsData = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  scoreSnapshot?: { elo: number; solved: number; rank: number } | null;
  exploits?: Array<{ id: string; bonus: number; message: string }>;
  landmines?: Array<{ id: string; penalty: number; message: string }>;
  validation?: {
    compiled: boolean;
    error: string;
    results: Array<{ problemId: string; correct: boolean; message: string }>;
  };
};

type ResultsScreenProps = {
  results: ResultsData;
  displayedSolveTarget: number;
  currentLevel: number;
  unlockedLevel: number;
  isLocalDev: boolean;
  github: string;
  email: string;
  setEmailAction: (v: string) => void;
  xHandle: string;
  setXHandleAction: (v: string) => void;
  flag: string;
  setFlagAction: (v: string) => void;
  emailError: string;
  setEmailErrorAction: (v: string) => void;
  xHandleError: string;
  setXHandleErrorAction: (v: string) => void;
  submitError: string | null;
  submittedLead: boolean;
  submitLeadFormAction: () => void;
  shareScoreAction: () => void;
  resetAllAction: () => void;
  startGameAction: (level: number) => void;
};

export function ResultsScreen({
  results,
  displayedSolveTarget,
  currentLevel,
  unlockedLevel,
  isLocalDev,
  github,
  email,
  setEmailAction,
  xHandle,
  setXHandleAction,
  flag,
  setFlagAction,
  emailError,
  setEmailErrorAction,
  xHandleError,
  setXHandleErrorAction,
  submitError,
  submittedLead,
  submitLeadFormAction,
  shareScoreAction,
  resetAllAction,
  startGameAction,
}: ResultsScreenProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const cumulativeResults = results.scoreSnapshot
    ? {
        ...results,
        elo: results.scoreSnapshot.elo,
        solved: results.scoreSnapshot.solved,
        rank: results.scoreSnapshot.rank,
      }
    : results;
  const isFinalVictory = cumulativeResults.solved >= TOTAL_SOLVE_TARGET;
  const isProgressionOnly = currentLevel === 1 || currentLevel === 2;
  const nextLevel = currentLevel === 1 ? 2 : 3;
  const canAdvance = isLocalDev || unlockedLevel > currentLevel;
  const levelTitle = currentLevel === 1 ? "Level 1 done" : "Level 2 done";

  if (isFinalVictory) {
    return (
      <VictoryScreen
        results={cumulativeResults}
        displayedSolveTarget={displayedSolveTarget}
        github={github}
        email={email}
        setEmailAction={setEmailAction}
        xHandle={xHandle}
        setXHandleAction={setXHandleAction}
        flag={flag}
        setFlagAction={setFlagAction}
        emailError={emailError}
        setEmailErrorAction={setEmailErrorAction}
        xHandleError={xHandleError}
        setXHandleErrorAction={setXHandleErrorAction}
        submitError={submitError}
        submittedLead={submittedLead}
        submitLeadFormAction={submitLeadFormAction}
        shareScoreAction={shareScoreAction}
        resetAllAction={resetAllAction}
      />
    );
  }

  const heroTitle = isProgressionOnly
    ? levelTitle
    : results.solved <= 2
      ? "Time's up"
      : "Keep going";
  const heroSubtitle = isProgressionOnly
    ? canAdvance
      ? `Level ${nextLevel} is ready.`
      : currentLevel === 1
        ? "Clear all Level 1 problems to unlock Level 2."
        : "Clear all Level 2 problems to unlock Level 3."
    : results.solved <= 2
      ? "Run it again with a cleaner pass."
      : "You still have room to climb.";

  const baseScore =
    results.elo -
    (results.exploits ?? []).reduce((sum, item) => sum + item.bonus, 0) -
    (results.landmines ?? []).reduce((sum, item) => sum + item.penalty, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: "120px 24px",
        position: "relative",
        overflowY: "auto",
      }}
    >
      <ResultsBackdrop />

      <div
        style={{
          width: "100%",
          maxWidth: RESULTS_LAYOUT.layoutWidth,
          position: "relative",
          zIndex: 10,
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 64,
            alignItems: "center",
          }}
        >
          <ResultsHero title={heroTitle} subtitle={heroSubtitle} />

          <ResultsStatsGrid
            stats={[
              { label: "Solved", value: `${results.solved}/${displayedSolveTarget}` },
              { label: "Score", value: results.elo.toLocaleString(), tone: "#fa5d19" },
              { label: "Rank", value: `#${results.rank}` },
            ]}
          />

          {!isProgressionOnly ? (
            <ResultsPanel maxWidth={RESULTS_LAYOUT.metricsWidth}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  borderBottom: "1px solid #f0f0f0",
                  paddingBottom: 16,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "#262626",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  [ Breakdown ]
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "rgba(0,0,0,0.3)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                ></span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                    fontSize: 13,
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  <span style={{ color: "rgba(0,0,0,0.45)" }}>
                    BASE SCORE ({results.solved} solved, {results.timeRemaining}s left)
                  </span>
                  <span style={{ fontWeight: 500, color: "#262626" }}>
                    {baseScore.toLocaleString()}
                  </span>
                </div>

                {(results.exploits ?? []).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      fontSize: 13,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    <span style={{ color: "#1a9338" }}>+ BONUS: {item.message}</span>
                    <span style={{ fontWeight: 500, color: "#1a9338" }}>+{item.bonus}</span>
                  </div>
                ))}

                {(results.landmines ?? []).map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      fontSize: 13,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    <span style={{ color: "#dc2626" }}>- PENALTY: {item.message}</span>
                    <span style={{ fontWeight: 500, color: "#dc2626" }}>{item.penalty}</span>
                  </div>
                ))}

                <div
                  style={{
                    marginTop: 12,
                    paddingTop: 20,
                    borderTop: "1px solid #efefef",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#262626",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    TOTAL SCORE
                  </span>
                  <span
                    style={{
                      fontSize: 28,
                      fontWeight: 600,
                      color: "#fa5d19",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    {results.elo.toLocaleString()}
                  </span>
                </div>
              </div>
            </ResultsPanel>
          ) : null}

          {!isProgressionOnly && results.solved >= 3 && !submittedLead ? (
            <ResultsPanel maxWidth={RESULTS_LAYOUT.metricsWidth}>
              {submitError ? (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "10px 14px",
                    background: "rgba(220,38,38,0.04)",
                    border: "1px solid rgba(220,38,38,0.15)",
                    borderRadius: 10,
                    color: "#dc2626",
                    fontSize: 13,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  {submitError}
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  maxWidth: RESULTS_LAYOUT.metricsWidth,
                  margin: "0 auto",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <label style={RESULTS_FIELD_LABEL_STYLE}>Email</label>
                    <input
                      value={email}
                      onChange={(e) => {
                        setEmailAction(e.target.value);
                        setEmailErrorAction("");
                      }}
                      placeholder="you@company.com"
                      style={{
                        ...RESULTS_INPUT_STYLE,
                        width: "100%",
                        borderColor: emailError ? "#dc2626" : "#e8e8e8",
                      }}
                    />
                  </div>
                  <div>
                    <label style={RESULTS_FIELD_LABEL_STYLE}>X Handle</label>
                    <input
                      value={xHandle}
                      onChange={(e) => {
                        setXHandleAction(e.target.value);
                        setXHandleErrorAction("");
                      }}
                      placeholder="@handle"
                      style={{
                        ...RESULTS_INPUT_STYLE,
                        width: "100%",
                        borderColor: xHandleError ? "#dc2626" : "#e8e8e8",
                      }}
                    />
                  </div>
                  <div>
                    <label style={RESULTS_FIELD_LABEL_STYLE}>GitHub</label>
                    <input
                      value={github}
                      readOnly
                      style={{
                        ...RESULTS_INPUT_STYLE,
                        width: "100%",
                        color: "rgba(0,0,0,0.45)",
                        background: "#f7f7f7",
                      }}
                    />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={RESULTS_FIELD_LABEL_STYLE}>CTF Flag (Optional)</label>
                    <input
                      value={flag}
                      onChange={(e) => setFlagAction(e.target.value)}
                      placeholder="flag{...}"
                      style={{ ...RESULTS_INPUT_STYLE, width: "100%" }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12,
                    marginTop: 8,
                  }}
                >
                  <button
                    className="btn-heat"
                    disabled={!email.trim()}
                    onClick={submitLeadFormAction}
                    style={{
                      height: 48,
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: !email.trim() ? "not-allowed" : "pointer",
                      opacity: !email.trim() ? 0.5 : 1,
                    }}
                  >
                    Submit details
                  </button>
                  <button
                    onClick={shareScoreAction}
                    className="btn-ghost"
                    style={{
                      height: 48,
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 500,
                      background: "transparent",
                      cursor: "pointer",
                      color: "#262626",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    Share on X
                  </button>
                  <button
                    onClick={resetAllAction}
                    className="btn-ghost"
                    style={{
                      height: 48,
                      borderRadius: 10,
                      fontSize: 14,
                      fontWeight: 500,
                      background: "transparent",
                      cursor: "pointer",
                      color: "rgba(0,0,0,0.65)",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </ResultsPanel>
          ) : null}

          {!isProgressionOnly && submittedLead ? (
            <ResultsPanel
              maxWidth={RESULTS_LAYOUT.metricsWidth}
              style={{
                padding: 24,
                background: "rgba(26,147,56,0.04)",
                borderColor: "rgba(26,147,56,0.18)",
                color: "#1a9338",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 20,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "#1a9338",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    marginBottom: 6,
                    fontSize: 12,
                    color: "#1a9338",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  Submitted
                </div>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, color: "#176d2a" }}>
                  Details received
                </h3>
                <p style={{ margin: 0, opacity: 0.8, fontSize: 14, color: "#176d2a" }}>
                  We&apos;ll be in touch.
                </p>
              </div>
              <div
                style={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                {[
                  { label: "GitHub", value: github || "UNKNOWN" },
                  { label: "Score", value: results.elo.toLocaleString() },
                  { label: "Rank", value: `#${results.rank}` },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid rgba(26,147,56,0.12)",
                      background: "rgba(255,255,255,0.45)",
                    }}
                  >
                    <div
                      style={{
                        marginBottom: 4,
                        fontSize: 11,
                        color: "rgba(26,147,56,0.7)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#176d2a",
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                  width: "100%",
                }}
              >
                <button
                  className="btn-heat"
                  onClick={shareScoreAction}
                  style={{ height: 44, borderRadius: 10, fontSize: 14 }}
                >
                  Share result
                </button>
                <button
                  onClick={resetAllAction}
                  className="btn-ghost"
                  style={{
                    height: 44,
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    color: "#262626",
                  }}
                >
                  Try again
                </button>
              </div>
            </ResultsPanel>
          ) : null}

          {!isProgressionOnly && results.solved < 3 && !submittedLead ? (
            <ResultsPanel maxWidth={RESULTS_LAYOUT.metricsWidth}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 12,
                }}
              >
                <button
                  className="btn-ghost"
                  onClick={shareScoreAction}
                  style={{
                    height: 48,
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    background: "transparent",
                    cursor: "pointer",
                    color: "#262626",
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  Share on X
                </button>
                <button
                  onClick={resetAllAction}
                  className="btn-heat"
                  style={{
                    height: 48,
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  Try again
                </button>
              </div>
            </ResultsPanel>
          ) : null}

          {isProgressionOnly ? (
            <ResultsPanel maxWidth={RESULTS_LAYOUT.metricsWidth}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: canAdvance ? "repeat(2, minmax(0, 1fr))" : "1fr",
                  gap: 12,
                }}
              >
                {canAdvance ? (
                  <button
                    onClick={() => startGameAction(nextLevel)}
                    className="btn-heat"
                    style={{
                      height: 48,
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Go to level {nextLevel}
                  </button>
                ) : null}
                <button
                  onClick={() => startGameAction(currentLevel)}
                  className="btn-ghost"
                  style={{
                    height: 48,
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 500,
                    cursor: "pointer",
                    color: "#262626",
                  }}
                >
                  Try level {currentLevel} again
                </button>
              </div>
            </ResultsPanel>
          ) : null}

          {isProgressionOnly && !canAdvance ? (
            <p
              style={{
                margin: "12px 0 0",
                fontSize: 13,
                color: "rgba(0,0,0,0.4)",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                textAlign: "center",
              }}
            >
              {currentLevel === 1
                ? "Level 2 unlocks after clearing all Level 1 problems."
                : "Level 3 unlocks after clearing all Level 2 problems."}
            </p>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 80,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          fontSize: 12,
          color: "rgba(0,0,0,0.16)",
          fontFamily: "var(--font-geist-mono), monospace",
          position: "relative",
          zIndex: 10,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>v2.0</span>
      </div>
    </div>
  );
}
