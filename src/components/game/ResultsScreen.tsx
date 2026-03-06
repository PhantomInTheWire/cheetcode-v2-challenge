"use client";

import React, { useEffect, useState } from "react";
import { TOTAL_SOLVE_TARGET } from "@/lib/constants";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { BrailleSpinner, AnimatedLandingDecor } from "@/components/game/decor";
import { VictoryScreen } from "@/components/game/VictoryScreen";

type ResultsData = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
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

  const isProgressionOnly = currentLevel === 1 || currentLevel === 2;
  const nextLevel = currentLevel === 1 ? 2 : 3;
  const canAdvance = isLocalDev || unlockedLevel > currentLevel;
  const levelTitle = currentLevel === 1 ? "Level 1 Complete" : "Level 2 Complete";

  const inputStyle: React.CSSProperties = {
    height: 44,
    padding: "0 14px",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid #e8e8e8",
    fontSize: 13,
    fontFamily: "var(--font-geist-mono), monospace",
    outline: "none",
    background: "#fafafa",
    color: "#262626",
    transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontFamily: "var(--font-geist-mono), monospace",
    color: "rgba(0,0,0,0.12)",
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 2,
    textAlign: "center",
  };

  const isFinalVictory = results.solved >= TOTAL_SOLVE_TARGET;

  if (isFinalVictory) {
    return (
      <VictoryScreen
        results={results}
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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: "80px 24px",
        position: "relative",
        overflowY: "auto",
      }}
    >
      {/* ── Background Elements ── */}
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
      <AnimatedLandingDecor />

      {/* Decorative labels */}
      {[
        { text: "[ STATUS ]", top: 32, left: 24 },
        { text: "[ TELEMETRY ]", bottom: 32, left: 24 },
        { text: "[ SHIP ]", top: 32, right: 24 },
        { text: "[ COMPLETE ]", bottom: 32, right: 24 },
      ].map((label, i) => (
        <div key={i} style={{ ...labelStyle, position: "absolute", ...label }}>
          {label.text}
        </div>
      ))}

      <div
        style={{
          width: "100%",
          maxWidth: 720,
          textAlign: "center",
          position: "relative",
          zIndex: 10,
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      >
        {/* Headline with inline flame */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 600 600"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "inline-block", flexShrink: 0 }}
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
              MISSION STATUS
            </span>
          </div>
          <h1
            style={{
              fontSize: 56,
              fontWeight: 500,
              margin: 0,
              lineHeight: 1,
              letterSpacing: -1.5,
              color: results.solved >= TOTAL_SOLVE_TARGET ? "#fa5d19" : "#262626",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {isProgressionOnly
              ? levelTitle
              : results.solved <= 2
                ? "TIME\u2019S UP"
                : results.solved < 10
                  ? "NOT BAD"
                  : "ALL CLEAR"}
          </h1>
          {!isProgressionOnly && results.solved >= TOTAL_SOLVE_TARGET && (
            <p
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: 450,
                color: "#fa5d19",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                opacity: 0.8,
              }}
            >
              We want to talk to you.
            </p>
          )}
        </div>

        {/* Stats row - Terminal cards style */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {[
            {
              label: "[ SOLVED ]",
              value: `${results.solved}/${displayedSolveTarget}`,
              color: "#262626",
            },
            { label: "[ SCORE ]", value: results.elo.toLocaleString(), color: "#fa5d19" },
            { label: "[ RANK ]", value: `#${results.rank}`, color: "#262626" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: "#ffffff",
                border: "1px solid #e8e8e8",
                borderRadius: 16,
                padding: "24px 16px",
                textAlign: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "rgba(0,0,0,0.3)",
                  letterSpacing: 0.5,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 500,
                  color: stat.color,
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: -1,
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Score Breakdown — Terminal Log style ── */}
        {!isProgressionOnly && (
          <div
            style={{
              textAlign: "left",
              background: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: 20,
              padding: "32px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
              marginBottom: 32,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 24,
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
                  letterSpacing: 0.5,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                [ SCORE_LOG ]
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "rgba(0,0,0,0.3)",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                v2.0.0-PROD
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Base score line */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                <span style={{ color: "rgba(0,0,0,0.45)" }}>
                  INIT_BASE_SCORE ({results.solved} solved, {results.timeRemaining}s rem)
                </span>
                <span style={{ fontWeight: 500, color: "#262626" }}>
                  {(
                    results.elo -
                    (results.exploits ?? []).reduce((s, e) => s + e.bonus, 0) -
                    (results.landmines ?? []).reduce((s, l) => s + l.penalty, 0)
                  ).toLocaleString()}
                </span>
              </div>

              {/* Exploits lines */}
              {(results.exploits ?? []).map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  <span style={{ color: "#1a9338" }}>+ EXPLOIT_BONUS: {e.message}</span>
                  <span style={{ fontWeight: 500, color: "#1a9338" }}>+{e.bonus}</span>
                </div>
              ))}

              {/* Landmines lines */}
              {(results.landmines ?? []).map((l) => (
                <div
                  key={l.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 13,
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  <span style={{ color: "#dc2626" }}>- SAFETY_PENALTY: {l.message}</span>
                  <span style={{ fontWeight: 500, color: "#dc2626" }}>{l.penalty}</span>
                </div>
              ))}

              {/* Final total */}
              <div
                style={{
                  marginTop: 20,
                  paddingTop: 20,
                  borderTop: "2px dashed #f0f0f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
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
                  TOTAL_ELO_CALCULATED
                </span>
                <span
                  style={{
                    fontSize: 32,
                    fontWeight: 500,
                    color: "#fa5d19",
                    fontFamily: "var(--font-geist-mono), monospace",
                    letterSpacing: -1,
                  }}
                >
                  {results.elo.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Capture form - More terminal style */}
        {!isProgressionOnly && results.solved >= 3 && !submittedLead && (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: 20,
              padding: "32px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
              textAlign: "left",
              marginBottom: 32,
            }}
          >
            <div style={{ marginBottom: 24 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#262626",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                [ SHIP_IDENTITY ]
              </span>
            </div>

            {submitError && (
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
            )}

            <div
              style={{
                display: "grid",
                gap: 20,
                gridTemplateColumns: "repeat(2, 1fr)",
              }}
            >
              {[
                {
                  label: "EMAIL",
                  value: email,
                  setter: (v: string) => {
                    setEmailAction(v);
                    setEmailErrorAction("");
                  },
                  error: emailError,
                  placeholder: "you@company.com",
                },
                { label: "GITHUB", value: github, readOnly: true },
                {
                  label: "X_HANDLE",
                  value: xHandle,
                  setter: (v: string) => {
                    setXHandleAction(v);
                    setXHandleErrorAction("");
                  },
                  error: xHandleError,
                  placeholder: "@handle",
                },
                {
                  label: "FLAG_OPTIONAL",
                  value: flag,
                  setter: setFlagAction,
                  placeholder: "flag{...}",
                },
              ].map((field) => (
                <div key={field.label} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "rgba(0,0,0,0.3)",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    {field.label}
                  </span>
                  <input
                    value={field.value}
                    readOnly={field.readOnly}
                    onChange={(e) => field.setter?.(e.target.value)}
                    placeholder={field.placeholder}
                    style={{
                      ...inputStyle,
                      borderColor: field.error ? "#dc2626" : "#e8e8e8",
                      color: field.readOnly ? "rgba(0,0,0,0.3)" : "#262626",
                      background: field.readOnly ? "rgba(0,0,0,0.02)" : "#fafafa",
                    }}
                    onFocus={(e) => {
                      if (!field.readOnly)
                        e.target.style.borderColor = field.error ? "#dc2626" : "#fa5d19";
                    }}
                    onBlur={(e) => {
                      if (!field.readOnly)
                        e.target.style.borderColor = field.error ? "#dc2626" : "#e8e8e8";
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginTop: 32 }}>
              <button
                className="btn-heat"
                disabled={!email.trim()}
                onClick={submitLeadFormAction}
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 500,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  border: "none",
                  cursor: !email.trim() ? "not-allowed" : "pointer",
                  opacity: !email.trim() ? 0.4 : 1,
                }}
              >
                VERIFY & SHIP
              </button>
            </div>
          </div>
        )}

        {/* Success message */}
        {!isProgressionOnly && submittedLead && (
          <div
            style={{
              marginBottom: 32,
              padding: "24px",
              background: "rgba(26,147,56,0.05)",
              border: "1px solid rgba(26,147,56,0.15)",
              borderRadius: 20,
              color: "#1a9338",
              fontSize: 16,
              fontWeight: 500,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Mission success. Data transmitted.
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
          }}
        >
          {isProgressionOnly ? (
            <>
              {canAdvance && (
                <button
                  onClick={() => startGameAction(nextLevel)}
                  className="btn-heat"
                  style={{
                    flex: 1,
                    maxWidth: 320,
                    height: 52,
                    borderRadius: 16,
                    fontSize: 16,
                    fontWeight: 500,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  CONTINUE TO LEVEL {nextLevel}
                </button>
              )}
              <button
                onClick={() => startGameAction(currentLevel)}
                style={{
                  flex: 1,
                  maxWidth: 320,
                  height: 52,
                  borderRadius: 16,
                  fontSize: 16,
                  fontWeight: 500,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  background: "rgba(0,0,0,0.04)",
                  color: "#262626",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
              >
                RETRY LEVEL {currentLevel}
              </button>
            </>
          ) : (
            <>
              {!isProgressionOnly && (
                <>
                  <button
                    onClick={shareScoreAction}
                    className="btn-heat"
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 16,
                      fontSize: 14,
                      fontWeight: 500,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    SHARE ON X
                  </button>
                  <button
                    onClick={resetAllAction}
                    style={{
                      flex: 1,
                      height: 48,
                      borderRadius: 16,
                      fontSize: 14,
                      fontWeight: 500,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      background: "rgba(0,0,0,0.04)",
                      color: "#262626",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                    }}
                  >
                    RETRY MISSION
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {isProgressionOnly && !canAdvance && (
          <p
            style={{
              marginTop: 24,
              fontSize: 13,
              color: "rgba(0,0,0,0.4)",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {currentLevel === 1
              ? `Level 2 unlocks after clearing all Level 1 problems.`
              : `Level 3 unlocks after clearing all Level 2 questions.`}
          </p>
        )}
      </div>

      {/* Footer footer */}
      <div
        style={{
          marginTop: 60,
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
        <span>[ FIRE_CTF_PROD ]</span>
        <span>·</span>
        <span>[ AUTH_SYNCED ]</span>
        <span>·</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <BrailleSpinner /> v2.0
        </span>
      </div>
    </div>
  );
}
