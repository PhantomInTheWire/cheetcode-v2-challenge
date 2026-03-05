"use client";

import React from "react";
import { TOTAL_SOLVE_TARGET } from "@/lib/constants";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";

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
  setEmail: (v: string) => void;
  xHandle: string;
  setXHandle: (v: string) => void;
  flag: string;
  setFlag: (v: string) => void;
  emailError: string;
  setEmailError: (v: string) => void;
  xHandleError: string;
  setXHandleError: (v: string) => void;
  submitError: string | null;
  submittedLead: boolean;
  submitLeadForm: () => void;
  shareScore: () => void;
  resetAll: () => void;
  startGame: (level: number) => void;
};

/* ── Firecrawl button shadow ── */
const HEAT_SHADOW = `
  inset 0px -6px 12px 0px rgba(250,25,25,0.2),
  0px 2px 4px 0px rgba(250,93,25,0.12),
  0px 1px 1px 0px rgba(250,93,25,0.12),
  0px 0.5px 0.5px 0px rgba(250,93,25,0.16),
  0px 0.25px 0.25px 0px rgba(250,93,25,0.2)
`;

export function ResultsScreen({
  results,
  displayedSolveTarget,
  currentLevel,
  unlockedLevel,
  isLocalDev,
  github,
  email,
  setEmail,
  xHandle,
  setXHandle,
  flag,
  setFlag,
  emailError,
  setEmailError,
  xHandleError,
  setXHandleError,
  submitError,
  submittedLead,
  submitLeadForm,
  shareScore,
  resetAll,
  startGame,
}: ResultsScreenProps) {
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
    transition: "border-color 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
  };
  const inputWrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  };
  const inputLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "rgba(0,0,0,0.35)",
    textAlign: "left",
    fontFamily: "var(--font-geist-mono), monospace",
  };

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

      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 20,
          padding: "48px 44px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Headline with inline flame */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
          <h2
            style={{
              fontSize: 36,
              fontWeight: 500,
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: -0.5,
              color: results.solved >= TOTAL_SOLVE_TARGET ? "#fa5d19" : "#262626",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {isProgressionOnly
              ? levelTitle
              : results.solved <= 2
                ? "Time\u2019s Up"
                : results.solved < 10
                  ? "Not Bad"
                  : "All Clear"}
          </h2>
        </div>

        {!isProgressionOnly && results.solved <= 2 && (
          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              color: "rgba(0,0,0,0.4)",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            You probably need a different approach.
          </p>
        )}
        {!isProgressionOnly && results.solved >= TOTAL_SOLVE_TARGET && (
          <p
            style={{
              marginTop: 12,
              fontSize: 15,
              fontWeight: 450,
              color: "#fa5d19",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            We want to talk to you.
          </p>
        )}

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 0,
            marginTop: 32,
            background: "#fafafa",
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #f0f0f0",
          }}
        >
          {[
            {
              label: "Solved",
              value: `${results.solved}/${displayedSolveTarget}`,
              color: "#262626",
            },
            { label: "Score", value: results.elo.toLocaleString(), color: "#fa5d19" },
            { label: "Rank", value: `#${results.rank}`, color: "#262626" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              style={{
                flex: 1,
                padding: "18px 16px",
                borderRight: i < 2 ? "1px solid #f0f0f0" : "none",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  color: "rgba(0,0,0,0.3)",
                  margin: 0,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                {stat.label}
              </p>
              <p
                style={{
                  fontSize: 24,
                  fontWeight: 500,
                  color: stat.color,
                  margin: "8px 0 0",
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Score Breakdown — only for final level ── */}
        {!isProgressionOnly && (
          <div style={{ marginTop: 28, textAlign: "left" }}>
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#262626",
                margin: "0 0 14px",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              Score Breakdown
            </p>

            {/* Base score */}
            <div
              style={{
                background: "#fafafa",
                borderRadius: 10,
                padding: "14px 18px",
                marginBottom: 10,
                border: "1px solid #f0f0f0",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span
                  style={{
                    color: "rgba(0,0,0,0.45)",
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  Base score ({results.solved}/{displayedSolveTarget} solved,{" "}
                  {results.timeRemaining}s remaining)
                </span>
                <span
                  style={{
                    fontWeight: 500,
                    color: "#262626",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {results.elo -
                    (results.exploits ?? []).reduce((s, e) => s + e.bonus, 0) -
                    (results.landmines ?? []).reduce((s, l) => s + l.penalty, 0)}
                </span>
              </div>
            </div>

            {/* ── Exploits ── */}
            {(results.exploits ?? []).length > 0 && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(250,93,25,0.15)",
                  overflow: "hidden",
                  marginBottom: 10,
                  background: "rgba(250,93,25,0.02)",
                }}
              >
                <div
                  style={{
                    padding: "10px 18px",
                    background: "rgba(250,93,25,0.05)",
                    borderBottom: "1px solid rgba(250,93,25,0.12)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#fa5d19",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    Exploits
                  </p>
                </div>
                {(results.exploits ?? []).map((e) => (
                  <div
                    key={e.id}
                    style={{
                      padding: "8px 18px",
                      borderBottom: "1px solid rgba(250,93,25,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>
                      &#10003;
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#262626",
                        flex: 1,
                        lineHeight: 1.5,
                        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      }}
                    >
                      {e.message}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#1a9338",
                        flexShrink: 0,
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      +{e.bonus}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Landmines ── */}
            {(results.landmines ?? []).length > 0 && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(220,38,38,0.15)",
                  overflow: "hidden",
                  marginBottom: 10,
                  background: "rgba(220,38,38,0.02)",
                }}
              >
                <div
                  style={{
                    padding: "10px 18px",
                    background: "rgba(220,38,38,0.05)",
                    borderBottom: "1px solid rgba(220,38,38,0.12)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#dc2626",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    Safety Issues
                  </p>
                </div>
                {(results.landmines ?? []).map((l) => (
                  <div
                    key={l.id}
                    style={{
                      padding: "8px 18px",
                      borderBottom: "1px solid rgba(220,38,38,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>
                      &#10007;
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#262626",
                        flex: 1,
                        lineHeight: 1.5,
                        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      }}
                    >
                      {l.message}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#dc2626",
                        flexShrink: 0,
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      {l.penalty}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Final Score */}
            <div
              style={{
                background: "#262626",
                borderRadius: 10,
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.6)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                Final Score
              </span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 500,
                  color: "#fa5d19",
                  fontFamily: "var(--font-geist-mono), monospace",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {results.elo.toLocaleString()}
              </span>
            </div>

            {currentLevel === 3 && results.validation && (
              <div
                style={{
                  marginTop: 14,
                  border: "1px solid #e8e8e8",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fafafa",
                }}
              >
                {(() => {
                  const passedCount = results.validation.results.filter((r) => r.correct).length;
                  const failedCount = Math.max(0, results.validation.results.length - passedCount);
                  return (
                    <>
                      <div
                        style={{
                          padding: "10px 18px",
                          borderBottom: "1px solid #e8e8e8",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            color: "#262626",
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            fontFamily: "var(--font-geist-mono), monospace",
                          }}
                        >
                          Stage 3 Verification
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            color: results.validation.compiled ? "#1a9338" : "#dc2626",
                            fontFamily: "var(--font-geist-mono), monospace",
                          }}
                        >
                          {passedCount}/{results.validation.results.length} checks passed
                        </span>
                      </div>
                      {!results.validation.compiled && (
                        <div
                          style={{
                            padding: "10px 18px",
                            borderBottom: "1px solid #e8e8e8",
                            fontSize: 13,
                            color: "#dc2626",
                            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                          }}
                        >
                          Compilation failed.
                        </div>
                      )}
                      {failedCount > 0 && (
                        <div
                          style={{
                            padding: "10px 18px",
                            fontSize: 13,
                            color: "rgba(0,0,0,0.6)",
                            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                          }}
                        >
                          {failedCount} check{failedCount === 1 ? "" : "s"} failed.
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Capture form */}
        {!isProgressionOnly && results.solved >= 3 && !submittedLead && (
          <div style={{ marginTop: 32 }}>
            {submitError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 14px",
                  background: "rgba(220,38,38,0.04)",
                  border: "1px solid rgba(220,38,38,0.15)",
                  borderRadius: 10,
                  color: "#dc2626",
                  fontSize: 13,
                  fontWeight: 450,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                }}
              >
                {submitError}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gap: 14,
                alignItems: "start",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                width: "100%",
              }}
            >
              <div style={inputWrapperStyle}>
                <span style={inputLabelStyle}>Email</span>
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  placeholder="you@company.com"
                  maxLength={254}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    minWidth: 0,
                    borderColor: emailError ? "#dc2626" : "#e8e8e8",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = emailError ? "#dc2626" : "#fa5d19")}
                  onBlur={(e) => (e.target.style.borderColor = emailError ? "#dc2626" : "#e8e8e8")}
                />
              </div>
              <div style={inputWrapperStyle}>
                <span style={inputLabelStyle}>GitHub</span>
                <input
                  value={github}
                  readOnly
                  style={{
                    ...inputStyle,
                    width: "100%",
                    minWidth: 0,
                    color: "rgba(0,0,0,0.35)",
                  }}
                />
              </div>
              <div style={inputWrapperStyle}>
                <span style={inputLabelStyle}>X Handle</span>
                <input
                  value={xHandle}
                  onChange={(e) => {
                    setXHandle(e.target.value);
                    setXHandleError("");
                  }}
                  placeholder="@x_handle"
                  maxLength={16}
                  style={{
                    ...inputStyle,
                    width: "100%",
                    minWidth: 0,
                    borderColor: xHandleError ? "#dc2626" : "#e8e8e8",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = xHandleError ? "#dc2626" : "#fa5d19")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = xHandleError ? "#dc2626" : "#e8e8e8")
                  }
                />
              </div>
              <div style={inputWrapperStyle}>
                <span style={inputLabelStyle}>Flag</span>
                <input
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  placeholder="flag{...}"
                  style={{
                    ...inputStyle,
                    width: "100%",
                    minWidth: 0,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#fa5d19")}
                  onBlur={(e) => (e.target.style.borderColor = "#e8e8e8")}
                />
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <button
                disabled={!email.trim()}
                onClick={submitLeadForm}
                style={{
                  width: "100%",
                  maxWidth: 280,
                  height: 40,
                  padding: "0 24px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 450,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  whiteSpace: "nowrap",
                  display: "block",
                  margin: "0 auto",
                  background: "#ff4c00",
                  color: "#ffffff",
                  border: "1px solid #f25515",
                  cursor: !email.trim() ? "not-allowed" : "pointer",
                  opacity: !email.trim() ? 0.4 : 1,
                  boxShadow: HEAT_SHADOW,
                  transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                }}
              >
                Submit
              </button>
            </div>
            {(emailError || xHandleError) && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  color: "#dc2626",
                  textAlign: "left",
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                }}
              >
                {emailError || xHandleError}
              </p>
            )}
          </div>
        )}

        {!isProgressionOnly && submittedLead && (
          <p
            style={{
              marginTop: 28,
              fontSize: 15,
              fontWeight: 450,
              color: "#1a9338",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            You&apos;re in. Share for the next challenge.
          </p>
        )}

        {/* Action buttons */}
        {!isProgressionOnly && (
          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 32,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <button
              onClick={shareScore}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 450,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                background: "#ff4c00",
                color: "#ffffff",
                border: "1px solid #f25515",
                cursor: "pointer",
                boxShadow: HEAT_SHADOW,
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
              }}
            >
              Share on X
            </button>
            <button
              onClick={resetAll}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 450,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                background: "rgba(0,0,0,0.04)",
                color: "#262626",
                border: "none",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {isProgressionOnly && canAdvance && (
          <button
            onClick={() => startGame(nextLevel)}
            style={{
              width: "100%",
              height: 48,
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 450,
              letterSpacing: 0.3,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              marginTop: 24,
              background: "#ff4c00",
              color: "#ffffff",
              border: "1px solid #f25515",
              cursor: "pointer",
              boxShadow: HEAT_SHADOW,
              transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          >
            {`Continue to Level ${nextLevel}`}
          </button>
        )}

        {isProgressionOnly && !canAdvance && (
          <p
            style={{
              marginTop: 20,
              fontSize: 14,
              color: "rgba(0,0,0,0.5)",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {currentLevel === 1
              ? "Level 2 unlocks after clearing all 25 Level 1 problems."
              : "Level 3 unlocks after clearing all 10 Level 2 questions."}
          </p>
        )}
      </div>
    </div>
  );
}
