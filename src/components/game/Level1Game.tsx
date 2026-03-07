"use client";

import React from "react";
import { PROBLEMS_PER_SESSION } from "@/lib/config/constants";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { BrailleSpinner } from "./decor";
import { useRoundCountdown } from "@/hooks/useRoundCountdown";

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
  const { timeUp } = useRoundCountdown(expiresAt);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#f9f9f9",
        position: "relative",
      }}
    >
      {/* ── Grid background (firecrawl dashboard pattern) ── */}
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

      {/* ── Header bar ── */}
      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: "1px solid #e8e8e8",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 450,
              color: "#262626",
              letterSpacing: 0.3,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Firecrawl CTF
          </span>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.12)" }}>·</span>
          <span
            style={{
              fontSize: 12,
              color: "rgba(0,0,0,0.3)",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            @{github}
          </span>
          {canAutoSolve && (
            <button
              onClick={autoSolveAction}
              disabled={isAutoSolving}
              style={{
                marginLeft: 4,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 450,
                background: "rgba(0,0,0,0.04)",
                color: "rgba(0,0,0,0.45)",
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                cursor: isAutoSolving ? "not-allowed" : "pointer",
                fontFamily: "var(--font-geist-mono), monospace",
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
              }}
            >
              {isAutoSolving ? "solving..." : "Auto Solve"}
            </button>
          )}
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              background: "rgba(250, 93, 25, 0.15)",
              color: "#fa5d19",
              borderRadius: 4,
              fontWeight: 500,
              marginLeft: 8,
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            LEVEL 1
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* ── SUBMIT button ── */}
          <button
            onClick={() => void finishGameAction()}
            disabled={isSubmitting}
            className="btn-heat"
            style={{
              height: 32,
              padding: "0 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 450,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              letterSpacing: 0.3,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.6 : 1,
              whiteSpace: "nowrap",
              position: "relative",
            }}
          >
            {isSubmitting ? "Submitting..." : "Finish & Submit"}
            {submitError && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  right: 0,
                  background: "#fef2f2",
                  border: "1px solid #ef4444",
                  color: "#dc2626",
                  padding: "6px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 450,
                  whiteSpace: "normal",
                  width: 200,
                  zIndex: 100,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                }}
              >
                {submitError}
              </div>
            )}
          </button>
        </div>
      </div>

      {/* ── Challenge Grid ── */}
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gridAutoRows: "minmax(560px, auto)",
          alignContent: "start",
          gap: 6,
          padding: 6,
          minHeight: 0,
          overflowY: "auto",
          position: "relative",
          zIndex: 1,
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
            status === "passed" ? "#22c55e" : status === "failed" ? "#ef4444" : "#e8e8e8";
          const bgColor =
            status === "passed" ? "#f0fdf4" : status === "failed" ? "#fef2f2" : "#ffffff";

          return (
            <div
              key={problem.id}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                borderRadius: 12,
                border: `1px solid ${borderColor}`,
                background: bgColor,
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  padding: "6px 10px",
                  borderBottom: "1px solid #f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 10,
                      color: "rgba(0,0,0,0.25)",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    [{String(idx + 1).padStart(2, "0")}]
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#262626",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 140,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    {problem.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontWeight: 500,
                    fontFamily: "var(--font-geist-mono), monospace",
                    background:
                      problem.tier === "competitive"
                        ? "rgba(147, 51, 234, 0.08)"
                        : problem.tier === "hard"
                          ? "rgba(220,38,38,0.08)"
                          : problem.tier === "medium"
                            ? "rgba(180,83,9,0.08)"
                            : "rgba(26,147,56,0.08)",
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
                        fontSize: 11,
                        color: "rgba(0,0,0,0.5)",
                        lineHeight: 1.5,
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      }}
                    >
                      {problem.description}
                    </p>
                  </div>
                ) : (
                  <p
                    style={{
                      fontSize: 11,
                      color: "rgba(0,0,0,0.5)",
                      lineHeight: 1.5,
                      margin: 0,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
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
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#fa5d19",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    {expandedQuestions[problem.id] ? "Collapse" : "Expand"}
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
                    background: status === "passed" ? "#f0fdf4" : "#fafafa",
                    color: status === "passed" ? "#1a9338" : "#262626",
                    border: "1px solid #e8e8e8",
                    borderRadius: 8,
                    padding: 8,
                    fontSize: 11,
                    lineHeight: 1.5,
                    fontFamily: "var(--font-geist-mono), monospace",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => {
                    if (status !== "passed") e.target.style.borderColor = "#fa5d19";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "#e8e8e8";
                  }}
                />
              </div>

              {/* Submit button */}
              <div style={{ padding: "6px 10px", flexShrink: 0 }}>
                <button
                  onClick={() => runLocalCheckAction(problem)}
                  disabled={timeUp || status === "passed" || !(codes[problem.id] ?? "").trim()}
                  className={status === "passed" ? "" : "btn-heat"}
                  style={{
                    width: "100%",
                    padding: "5px 0",
                    borderRadius: 8,
                    border: status === "passed" ? "none" : undefined,
                    fontSize: 11,
                    fontWeight: 450,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    cursor:
                      timeUp || status === "passed" || !(codes[problem.id] ?? "").trim()
                        ? "not-allowed"
                        : "pointer",
                    background: status === "passed" ? "rgba(26,147,56,0.08)" : undefined,
                    color: status === "passed" ? "#1a9338" : undefined,
                  }}
                >
                  {status === "passed"
                    ? "Passed"
                    : status === "failed"
                      ? "Retry"
                      : status === "submitting"
                        ? "..."
                        : "Run Check"}
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
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
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
              border: "1px solid #e8e8e8",
              boxShadow: "0 24px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.08)",
              maxWidth: 480,
            }}
          >
            {/* Flame logo */}
            <div style={{ marginBottom: 20 }}>
              <svg
                width="40"
                height="40"
                viewBox="0 0 600 600"
                preserveAspectRatio="xMidYMid meet"
                style={{ display: "inline-block" }}
                dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
              />
            </div>
            <p
              style={{
                fontSize: 40,
                fontWeight: 500,
                color: solvedLocal === PROBLEMS_PER_SESSION ? "#1a9338" : "#262626",
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: -0.5,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              {isSubmitting
                ? "Submitting..."
                : solvedLocal === PROBLEMS_PER_SESSION
                  ? "All Clear"
                  : "Time\u2019s Up"}
            </p>
            <p
              style={{
                fontSize: 16,
                color: "rgba(0,0,0,0.4)",
                margin: "12px 0 0",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                fontWeight: 400,
              }}
            >
              {solvedLocal}/{PROBLEMS_PER_SESSION} solved
            </p>
            {!isSubmitting && (
              <button
                onClick={() => void finishGameAction()}
                className="btn-heat"
                style={{
                  marginTop: 28,
                  padding: "12px 44px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 450,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                }}
              >
                See Results
              </button>
            )}
            {isSubmitting && (
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(0,0,0,0.3)",
                  marginTop: 20,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <BrailleSpinner />
                <span>Validating your solutions on the server...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
