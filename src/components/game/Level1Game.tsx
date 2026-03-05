"use client";

import React from "react";
import { PROBLEMS_PER_SESSION, ROUND_DURATION_MS } from "@/lib/constants";

type GameProblem = {
  id: string;
  title: string;
  tier: "easy" | "medium" | "hard" | "competitive";
  description: string;
  signature: string;
  starterCode: string;
  testCases: Array<{
    input: Record<string, unknown>;
    expected: unknown;
    args?: unknown[];
  }>;
};

type Level1GameProps = {
  github: string;
  canAutoSolve: boolean;
  autoSolveAction: () => void;
  isAutoSolving: boolean;
  solvedLocal: number;
  expiresAt: number;
  finishGameAction: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  problems: GameProblem[];
  localPass: Record<string, boolean | null>;
  codes: Record<string, string>;
  setCodesAction: (
    v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  runLocalCheckAction: (problem: GameProblem) => void;
};

export function Level1Game({
  github,
  canAutoSolve,
  autoSolveAction,
  isAutoSolving,
  solvedLocal,
  expiresAt,
  finishGameAction,
  isSubmitting,
  submitError,
  problems,
  localPass,
  codes,
  setCodesAction,
  runLocalCheckAction,
}: Level1GameProps) {
  const [expandedQuestions, setExpandedQuestions] = React.useState<Record<string, boolean>>({});
  const [timeLeftMs, setTimeLeftMs] = React.useState(ROUND_DURATION_MS);

  React.useEffect(() => {
    const syncTimeLeft = () => {
      setTimeLeftMs(Math.max(0, expiresAt - Date.now()));
    };
    syncTimeLeft();
    const id = window.setInterval(syncTimeLeft, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progress = Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_MS) * 100));
  const timeUp = timeLeftMs === 0;
  const timerBg = secondsLeft <= 10 ? "#dc2626" : secondsLeft <= 20 ? "#fa5d19" : "#1a9338";
  const timerFg = timerBg;

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#f9f9f9",
        fontFamily: "'SF Mono', 'Fira Code', var(--font-geist-mono), monospace",
      }}
    >
      {/* ── Header bar ── */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: "1px solid #e5e5e5",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔥</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#fa5d19", letterSpacing: -0.5 }}>
            FIRECRAWL CTF
          </span>
          <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", marginLeft: 4 }}>@{github}</span>
          {canAutoSolve && (
            <button
              onClick={autoSolveAction}
              disabled={isAutoSolving}
              style={{
                marginLeft: 8,
                padding: "2px 10px",
                fontSize: 10,
                fontWeight: 600,
                background: "#f3f3f3",
                color: "rgba(0,0,0,0.5)",
                border: "1px solid #e5e5e5",
                borderRadius: 4,
                cursor: isAutoSolving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {isAutoSolving ? "solving..." : "⚡ Auto Solve"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Solved */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(0,0,0,0.35)",
                textTransform: "uppercase",
              }}
            >
              Solved
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: solvedLocal === PROBLEMS_PER_SESSION ? "#1a9338" : "#262626",
              }}
            >
              {solvedLocal}
              <span style={{ color: "rgba(0,0,0,0.25)" }}>/{PROBLEMS_PER_SESSION}</span>
            </span>
          </div>
          {/* Timer */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 140,
                height: 5,
                background: "#e5e5e5",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: timerBg,
                  borderRadius: 4,
                  transition: "width 100ms linear, background 500ms",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: timerFg,
                minWidth: 48,
                textAlign: "right",
                transition: "color 500ms",
                ...(secondsLeft <= 10
                  ? { animation: "timer-pulse 0.6s ease-in-out infinite" }
                  : {}),
              }}
            >
              {timeUp ? "TIME" : `0:${String(secondsLeft).padStart(2, "0")}`}
            </span>
          </div>
          {/* ── Big SUBMIT button ── */}
          <button
            onClick={() => void finishGameAction()}
            disabled={isSubmitting}
            className="btn-heat"
            style={{
              height: 32,
              padding: "0 20px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              fontFamily: "inherit",
              letterSpacing: 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              whiteSpace: "nowrap",
              position: "relative",
            }}
          >
            {isSubmitting ? "SUBMITTING..." : "FINISH & SUBMIT"}
            {submitError && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "#fef2f2",
                  border: "1px solid #ef4444",
                  color: "#dc2626",
                  padding: "4px 8px",
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                  whiteSpace: "normal",
                  width: 200,
                  zIndex: 100,
                }}
              >
                {submitError}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ── 5×2 Challenge Grid ── */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gridAutoRows: "minmax(560px, auto)",
          alignContent: "start",
          gap: 8,
          padding: 8,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {problems.map((problem, idx) => {
          const status =
            problem.id in localPass
              ? localPass[problem.id] === null
                ? "submitting"
                : localPass[problem.id]
                  ? "passed"
                  : "failed"
              : "idle";

          const borderColor =
            status === "passed" ? "#22c55e" : status === "failed" ? "#ef4444" : "#e5e5e5";
          const bgColor =
            status === "passed" ? "#f0fdf4" : status === "failed" ? "#fef2f2" : "#ffffff";

          return (
            <div
              key={problem.id}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 8,
                border: `1px solid ${borderColor}`,
                background: bgColor,
                transition: "all 300ms",
                boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  padding: "5px 8px",
                  borderBottom: "1px solid #f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10, color: "rgba(0,0,0,0.3)" }}>#{idx + 1}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#262626",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 120,
                    }}
                  >
                    {problem.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 6px",
                    borderRadius: 999,
                    fontWeight: 600,
                    background:
                      problem.tier === "competitive"
                        ? "rgba(147, 51, 234, 0.10)"
                        : problem.tier === "hard"
                          ? "rgba(220,38,38,0.10)"
                          : problem.tier === "medium"
                            ? "rgba(180,83,9,0.10)"
                            : "rgba(26,147,56,0.10)",
                    color:
                      problem.tier === "competitive"
                        ? "#9333ea"
                        : problem.tier === "hard"
                          ? "#dc2626"
                          : problem.tier === "medium"
                            ? "#b45309"
                            : "#1a9338",
                  }}
                >
                  {problem.tier}
                </span>
              </div>

              {/* Description */}
              <div style={{ padding: "8px 10px", flexShrink: 0 }}>
                {expandedQuestions[problem.id] ? (
                  <div
                    style={{
                      maxHeight: 180,
                      overflowY: "auto",
                      paddingRight: 2,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: "rgba(0,0,0,0.5)",
                        lineHeight: 1.4,
                        margin: 0,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {problem.description}
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", lineHeight: 1.4, margin: 0 }}>
                    {problem.description.length > 280
                      ? `${problem.description.slice(0, 280)}...`
                      : problem.description}
                  </p>
                )}
                {problem.description.length > 280 && (
                  <button
                    onClick={() =>
                      setExpandedQuestions((cur) => ({
                        ...cur,
                        [problem.id]: !cur[problem.id],
                      }))
                    }
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fa5d19",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {expandedQuestions[problem.id] ? "Collapse question" : "Expand question"}
                  </button>
                )}
              </div>

              {/* Code textarea */}
              <div
                style={{
                  flex: "1 1 auto",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 0,
                  padding: "0 10px",
                }}
              >
                <textarea
                  value={codes[problem.id] ?? ""}
                  onChange={(e) =>
                    setCodesAction((cur) => ({ ...cur, [problem.id]: e.target.value }))
                  }
                  disabled={timeUp || status === "passed"}
                  placeholder={problem.signature}
                  spellCheck={false}
                  style={{
                    flex: "1 1 auto",
                    minHeight: 320,
                    width: "100%",
                    resize: "none",
                    background: "#fafafa",
                    color: status === "passed" ? "#1a9338" : "#262626",
                    border: "1px solid #e5e5e5",
                    borderRadius: 4,
                    padding: 6,
                    fontSize: 10,
                    lineHeight: 1.4,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
                />
              </div>

              {/* Submit button */}
              <div style={{ padding: "5px 8px", flexShrink: 0 }}>
                <button
                  onClick={() => runLocalCheckAction(problem)}
                  disabled={timeUp || status === "passed" || !(codes[problem.id] ?? "").trim()}
                  style={{
                    width: "100%",
                    padding: "4px 0",
                    borderRadius: 4,
                    border: "none",
                    fontSize: 10,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor:
                      timeUp || status === "passed" || !(codes[problem.id] ?? "").trim()
                        ? "not-allowed"
                        : "pointer",
                    background:
                      status === "passed" ? "rgba(26,147,56,0.1)" : timeUp ? "#e5e5e5" : "#fa5d19",
                    color: status === "passed" ? "#1a9338" : timeUp ? "rgba(0,0,0,0.3)" : "#fff",
                    transition: "all 150ms",
                  }}
                >
                  {status === "passed"
                    ? "✓ PASSED"
                    : status === "failed"
                      ? "✗ RETRY"
                      : status === "submitting"
                        ? "..."
                        : "SUBMIT"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Time's up / submitting overlay ── */}
      {(timeUp || isSubmitting) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              textAlign: "center",
              background: "#ffffff",
              borderRadius: 20,
              padding: "48px 56px",
              border: "1px solid #e5e5e5",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <p
              style={{
                fontSize: 52,
                fontWeight: 800,
                color: solvedLocal === PROBLEMS_PER_SESSION ? "#1a9338" : "#dc2626",
                margin: 0,
              }}
            >
              {isSubmitting
                ? "SUBMITTING..."
                : solvedLocal === PROBLEMS_PER_SESSION
                  ? "ALL CLEAR 🔥"
                  : "TIME'S UP"}
            </p>
            <p style={{ fontSize: 22, color: "rgba(0,0,0,0.45)", margin: "8px 0 0" }}>
              {solvedLocal}/{PROBLEMS_PER_SESSION} solved locally
            </p>
            {!isSubmitting && (
              <button
                onClick={() => void finishGameAction()}
                className="btn-heat"
                style={{
                  marginTop: 32,
                  padding: "14px 48px",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 800,
                  fontFamily: "inherit",
                  letterSpacing: 1,
                }}
              >
                SEE RESULTS
              </button>
            )}
            {isSubmitting && (
              <p style={{ fontSize: 14, color: "rgba(0,0,0,0.35)", marginTop: 20 }}>
                Validating your solutions on the server...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
