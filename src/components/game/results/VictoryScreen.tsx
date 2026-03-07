"use client";

import React, { useEffect, useState } from "react";
import { Easing, interpolate, spring } from "remotion";
import {
  RESULTS_FIELD_LABEL_STYLE,
  RESULTS_INPUT_STYLE,
  RESULTS_LAYOUT,
  ResultsBackdrop,
  ResultsHero,
  ResultsPanel,
  ResultsStatsGrid,
} from "@/components/game/results/results-shared";

type ResultsData = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  scoreSnapshot?: { elo: number; solved: number; rank: number } | null;
  exploits?: Array<{ id: string; bonus: number; message: string }>;
  landmines?: Array<{ id: string; penalty: number; message: string }>;
};

type VictoryScreenProps = {
  results: ResultsData;
  displayedSolveTarget: number;
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
};

const REMOTION_FPS = 60;

function useRemotionFrame(active: boolean) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      setFrame(((now - start) / 1000) * REMOTION_FPS);
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active]);

  return active ? frame : 0;
}

export function VictoryScreen({
  results,
  displayedSolveTarget,
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
}: VictoryScreenProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefersReducedMotion(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  const revealFrame = useRemotionFrame(!prefersReducedMotion);
  const typedTitle = "All Clear";
  const typedSubtitle = "We want to talk to you.";

  const revealText = (text: string, start: number, end: number) => {
    if (prefersReducedMotion) return text;
    const count = Math.floor(
      interpolate(revealFrame, [start, end], [0, text.length], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.linear,
      }),
    );
    return text.slice(0, count);
  };

  const springProgress = (delay: number, durationInFrames = 22) => {
    if (prefersReducedMotion) return 1;
    return spring({
      frame: Math.max(0, revealFrame - delay),
      fps: REMOTION_FPS,
      durationInFrames,
      config: { damping: 200 },
    });
  };

  const revealStyle = (delay: number, y = 18, scale = 0.99): React.CSSProperties => {
    const progress = springProgress(delay);
    return {
      opacity: interpolate(progress, [0, 1], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
      transform: `translateY(${interpolate(progress, [0, 1], [y, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })}px) scale(${interpolate(progress, [0, 1], [scale, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })})`,
    };
  };

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: "120px 24px",
        boxSizing: "border-box",
        position: "relative",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <ResultsBackdrop />
      <div
        style={{
          width: "100%",
          maxWidth: RESULTS_LAYOUT.layoutWidth,
          position: "relative",
          zIndex: 10,
          ...revealStyle(0, 20, 1),
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
          <div
            style={{
              width: "100%",
              maxWidth: RESULTS_LAYOUT.heroWidth,
              ...revealStyle(2, 14, 1),
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 48,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0, width: "100%" }}>
                <div
                  style={{
                    opacity: interpolate(springProgress(7), [0, 1], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    transform: `translateY(${interpolate(springProgress(7), [0, 1], [10, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })}px) scale(${interpolate(springProgress(7), [0, 1], [0.82, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })})`,
                  }}
                >
                  <ResultsHero
                    title={revealText(typedTitle, 8, 18)}
                    subtitle={revealText(typedSubtitle, 14, 26)}
                    titleColor="#fa5d19"
                    subtitleColor="#fa5d19"
                    flameSize={64}
                  />
                </div>
              </div>

              <ResultsStatsGrid
                maxWidth={RESULTS_LAYOUT.metricsWidth}
                stats={[
                  {
                    label: "Solved",
                    value: `${results.solved}/${displayedSolveTarget}`,
                    tone: "#262626",
                  },
                  {
                    label: "Score",
                    value: results.elo.toLocaleString(),
                    tone: "#fa5d19",
                  },
                  { label: "Rank", value: `#${results.rank}`, tone: "#262626" },
                ]}
                animatedStyles={[
                  revealStyle(12, 10, 0.985),
                  revealStyle(15, 10, 0.985),
                  revealStyle(18, 10, 0.985),
                ]}
              />
            </div>
          </div>

          {!submittedLead ? (
            <ResultsPanel
              maxWidth={RESULTS_LAYOUT.metricsWidth}
              style={{
                ...revealStyle(18, 16, 1),
              }}
            >
              {submitError && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: "10px",
                    background: "rgba(220,38,38,0.05)",
                    border: "1px solid rgba(220,38,38,0.12)",
                    borderRadius: 10,
                    color: "#dc2626",
                    fontSize: 13,
                  }}
                >
                  {submitError}
                </div>
              )}
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
                      placeholder="agent@company.com"
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
                    onClick={submitLeadFormAction}
                    disabled={!email.trim()}
                    style={{
                      height: 48,
                      minHeight: 48,
                      borderRadius: 10,
                      fontSize: 15,
                      fontWeight: 500,
                      opacity: !email.trim() ? 0.5 : 1,
                      cursor: !email.trim() ? "not-allowed" : "pointer",
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
          ) : (
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
                ...revealStyle(18, 16, 1),
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
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>
                  Details received
                </h3>
                <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>We&apos;ll be in touch.</p>
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
          )}
        </div>
      </div>
      <style jsx>{`
        @keyframes victory-pulse {
          0% {
            transform: scale(0.96);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
