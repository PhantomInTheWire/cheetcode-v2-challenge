"use client";

import React from "react";
import { TOTAL_SOLVE_TARGET, PROBLEMS_PER_SESSION, LEVEL2_TOTAL } from "@/lib/constants";

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

export function ResultsScreen({
  results,
  displayedSolveTarget,
  currentLevel,
  unlockedLevel,
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
  const levelTitle = currentLevel === 1 ? "LEVEL 1 COMPLETE" : "LEVEL 2 COMPLETE";
  const inputStyle: React.CSSProperties = {
    height: 44,
    padding: "0 14px",
    borderRadius: 10,
    border: "1px solid #e5e5e5",
    fontSize: 13,
    fontFamily: "inherit",
    outline: "none",
    background: "#fafafa",
    color: "#262626",
    transition: "border-color 0.2s",
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
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: 20,
          padding: "48px 44px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {/* Headline */}
        <h2
          style={{
            fontSize: 44,
            fontWeight: 800,
            margin: 0,
            lineHeight: 1.1,
            color: results.solved >= TOTAL_SOLVE_TARGET ? "#fa5d19" : "#262626",
          }}
        >
          {isProgressionOnly
            ? levelTitle
            : results.solved <= 2
              ? "TIME'S UP"
              : results.solved < 10
                ? "NOT BAD"
                : "ALL CLEAR 🔥"}
        </h2>

        {!isProgressionOnly && results.solved <= 2 && (
          <p style={{ marginTop: 16, fontSize: 15, color: "rgba(0,0,0,0.45)" }}>
            You probably need a different approach.
          </p>
        )}
        {!isProgressionOnly && results.solved >= TOTAL_SOLVE_TARGET && (
          <p style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: "#fa5d19" }}>
            We want to talk to you.
          </p>
        )}

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 0,
            marginTop: 36,
            background: "#f3f3f3",
            borderRadius: 14,
            overflow: "hidden",
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
                padding: "20px 16px",
                borderRight: i < 2 ? "1px solid #e5e5e5" : "none",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  color: "rgba(0,0,0,0.35)",
                  margin: 0,
                }}
              >
                {stat.label}
              </p>
              <p style={{ fontSize: 26, fontWeight: 800, color: stat.color, margin: "8px 0 0" }}>
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
                fontSize: 13,
                fontWeight: 700,
                color: "#262626",
                margin: "0 0 14px",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Score Breakdown
            </p>

            {/* Base score */}
            <div
              style={{
                background: "#f3f3f3",
                borderRadius: 10,
                padding: "14px 18px",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(0,0,0,0.5)" }}>
                  Base score ({results.solved}/{displayedSolveTarget} solved,{" "}
                  {results.timeRemaining}s remaining)
                </span>
                <span style={{ fontWeight: 700, color: "#262626" }}>
                  {results.elo -
                    (results.exploits ?? []).reduce((s, e) => s + e.bonus, 0) -
                    (results.landmines ?? []).reduce((s, l) => s + l.penalty, 0)}
                </span>
              </div>
            </div>

            {/* ── Exploits — only visible if they found any ── */}
            {(results.exploits ?? []).length > 0 && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(250,93,25,0.2)",
                  overflow: "hidden",
                  marginBottom: 10,
                  background: "rgba(250,93,25,0.03)",
                }}
              >
                <div
                  style={{
                    padding: "10px 18px",
                    background: "rgba(250,93,25,0.06)",
                    borderBottom: "1px solid rgba(250,93,25,0.15)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fa5d19",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 1,
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
                      borderBottom: "1px solid rgba(250,93,25,0.1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>
                      ✓
                    </span>
                    <span style={{ fontSize: 11, color: "#262626", flex: 1, lineHeight: 1.5 }}>
                      {e.message}
                    </span>
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: "#1a9338", flexShrink: 0 }}
                    >
                      +{e.bonus}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Landmines — only visible if they triggered any ── */}
            {(results.landmines ?? []).length > 0 && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(220,38,38,0.2)",
                  overflow: "hidden",
                  marginBottom: 10,
                  background: "rgba(220,38,38,0.03)",
                }}
              >
                <div
                  style={{
                    padding: "10px 18px",
                    background: "rgba(220,38,38,0.06)",
                    borderBottom: "1px solid rgba(220,38,38,0.15)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#dc2626",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 1,
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
                      borderBottom: "1px solid rgba(220,38,38,0.1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>
                      ✗
                    </span>
                    <span style={{ fontSize: 11, color: "#262626", flex: 1, lineHeight: 1.5 }}>
                      {l.message}
                    </span>
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", flexShrink: 0 }}
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
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Final Score
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#fa5d19" }}>
                {results.elo.toLocaleString()}
              </span>
            </div>

            {currentLevel === 3 && results.validation && (
              <div
                style={{
                  marginTop: 14,
                  border: "1px solid #e5e5e5",
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
                          borderBottom: "1px solid #e5e5e5",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#262626",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          Stage 3 Verification
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: results.validation.compiled ? "#1a9338" : "#dc2626",
                          }}
                        >
                          {passedCount}/{results.validation.results.length} checks passed
                        </span>
                      </div>
                      {!results.validation.compiled && (
                        <div
                          style={{
                            padding: "10px 18px",
                            borderBottom: "1px solid #e5e5e5",
                            fontSize: 12,
                            color: "#dc2626",
                          }}
                        >
                          Compilation failed.
                        </div>
                      )}
                      {failedCount > 0 && (
                        <div
                          style={{ padding: "10px 18px", fontSize: 12, color: "rgba(0,0,0,0.7)" }}
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

        {/* Capture form — inline row */}
        {!isProgressionOnly && results.solved >= 3 && !submittedLead && (
          <div style={{ marginTop: 32 }}>
            {submitError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  background: "#fef2f2",
                  border: "1px solid #ef4444",
                  borderRadius: 8,
                  color: "#dc2626",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {submitError}
              </div>
            )}
            <div
              style={{
                display: "grid",
                gap: 12,
                alignItems: "start",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              }}
            >
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                placeholder="Email"
                maxLength={254}
                style={{
                  ...inputStyle,
                  width: "100%",
                  minWidth: 0,
                  borderColor: emailError ? "#dc2626" : "#e5e5e5",
                }}
                onFocus={(e) => (e.target.style.borderColor = emailError ? "#dc2626" : "#fa5d19")}
                onBlur={(e) => (e.target.style.borderColor = emailError ? "#dc2626" : "#e5e5e5")}
              />
              <input
                value={github}
                readOnly
                style={{ ...inputStyle, width: "100%", minWidth: 0, color: "rgba(0,0,0,0.35)" }}
              />
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
                  borderColor: xHandleError ? "#dc2626" : "#e5e5e5",
                }}
                onFocus={(e) => (e.target.style.borderColor = xHandleError ? "#dc2626" : "#fa5d19")}
                onBlur={(e) => (e.target.style.borderColor = xHandleError ? "#dc2626" : "#e5e5e5")}
              />
              <input
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                placeholder="🔥{...}"
                style={{
                  ...inputStyle,
                  width: "100%",
                  minWidth: 0,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#fa5d19")}
                onBlur={(e) => (e.target.style.borderColor = "#e5e5e5")}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                disabled={!email.trim()}
                onClick={submitLeadForm}
                className="btn-heat"
                style={{
                  width: "100%",
                  height: 44,
                  padding: "0 24px",
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                SUBMIT
              </button>
            </div>
            {(emailError || xHandleError) && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", textAlign: "left" }}>
                {emailError || xHandleError}
              </p>
            )}
          </div>
        )}

        {!isProgressionOnly && submittedLead && (
          <p style={{ marginTop: 28, fontSize: 15, fontWeight: 600, color: "#1a9338" }}>
            You&apos;re in. Share for the next challenge 🔥
          </p>
        )}

        {/* Action buttons */}
        {!isProgressionOnly && (
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 36,
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            }}
          >
            <button
              onClick={shareScore}
              className="btn-heat"
              style={{
                flex: 1,
                height: 46,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "inherit",
              }}
            >
              SHARE ON X
            </button>
            <button
              onClick={resetAll}
              className="btn-heat"
              style={{
                flex: 1,
                height: 46,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "inherit",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {isProgressionOnly && (
          <button
            onClick={() => startGame(nextLevel)}
            className="btn-heat"
            style={{
              width: "100%",
              height: 52,
              borderRadius: 12,
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: 2,
              fontFamily: "inherit",
              marginTop: 20,
              background: "#fa5d19",
            }}
          >
            {`CONTINUE TO LEVEL ${nextLevel} →`}
          </button>
        )}
      </div>
    </div>
  );
}
