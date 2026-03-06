"use client";

import React, { useEffect, useState } from "react";
import { Easing, interpolate, spring } from "remotion";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { AnimatedLandingDecor } from "@/components/game/decor";

type ResultsData = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
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
    if (!active) {
      setFrame(0);
      return;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (now: number) => {
      setFrame(((now - start) / 1000) * REMOTION_FPS);
      raf = window.requestAnimationFrame(tick);
    };

    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [active]);

  return frame;
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
  const [phase, setPhase] = useState<"enter" | "reveal">("enter");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefersReducedMotion(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setPhase("reveal"), prefersReducedMotion ? 120 : 900);
    return () => clearTimeout(timer);
  }, [prefersReducedMotion]);

  const revealFrame = useRemotionFrame(phase === "reveal" && !prefersReducedMotion);
  const typedRecord = "Results";
  const typedTitle = "All Clear";
  const typedSubtitle = "Submit your details below.";

  const revealText = (text: string, start: number, end: number) => {
    if (prefersReducedMotion || phase !== "reveal") return text;
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
    if (prefersReducedMotion || phase !== "reveal") return 1;
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

  const inputStyle: React.CSSProperties = {
    height: 48,
    padding: "0 16px",
    boxSizing: "border-box",
    borderRadius: 10,
    border: "1px solid #e8e8e8",
    fontSize: 14,
    fontFamily: "var(--font-geist-mono), monospace",
    outline: "none",
    background: "#ffffff",
    color: "#262626",
    transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
  };

  const sectionStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e8e8e8",
    borderRadius: 10,
    padding: 24,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(0,0,0,0.4)",
    marginBottom: 6,
    fontFamily: "var(--font-geist-mono), monospace",
    textTransform: "uppercase",
  };

  const decorLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontFamily: "var(--font-geist-mono), monospace",
    color: "rgba(0,0,0,0.12)",
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 2,
    textAlign: "center",
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: phase === "enter" ? "40px 24px" : "24px",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
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
          opacity: 0.45,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "12px 12px",
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
            radial-gradient(ellipse at bottom right, rgba(250,93,25,0.03) 0%, transparent 55%)
          `,
        }}
      />
      <AnimatedLandingDecor />

      {[
        { text: "[ RESULTS ]", top: 32, left: 24 },
        { text: "[ DETAILS ]", top: 32, right: 24 },
      ].map((label, i) => (
        <div key={i} style={{ ...decorLabelStyle, position: "absolute", ...label }}>
          {label.text}
        </div>
      ))}

      {phase === "enter" && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            animation: prefersReducedMotion
              ? "none"
              : "victory-pulse 0.8s cubic-bezier(0.25, 0.1, 0.25, 1)",
          }}
        >
          <div style={{ transform: "scale(2)" }}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 600 600"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "inline-block" }}
              dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
            />
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: "#262626",
              letterSpacing: "0.04em",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            Loading results
          </h1>
        </div>
      )}

      {phase === "reveal" && (
        <div
          style={{
            width: "100%",
            maxWidth: 860,
            position: "relative",
            zIndex: 10,
            ...revealStyle(0, 20, 1),
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                padding: "8px 12px 0",
                ...revealStyle(2, 14, 1),
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 14,
                  }}
                >
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 12,
                      opacity: interpolate(springProgress(4), [0, 1], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                      transform: `translateY(${interpolate(springProgress(4), [0, 1], [10, 0], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      })}px)`,
                    }}
                  >
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 600 600"
                      preserveAspectRatio="xMidYMid meet"
                      style={{ display: "inline-block" }}
                      dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
                    />
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "#262626",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      {revealText(typedRecord, 4, 15)}
                    </span>
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                    <h1
                      style={{
                        margin: "0 0 14px",
                        fontSize: 64,
                        fontWeight: 500,
                        color: "#fa5d19",
                        letterSpacing: "-0.05em",
                      lineHeight: 1,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    {revealText(typedTitle, 8, 18)}
                  </h1>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 16,
                        color: "#fa5d19",
                        lineHeight: 1.4,
                        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      opacity: 0.85,
                    }}
                  >
                    {revealText(typedSubtitle, 14, 26)}
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 16,
                    width: "100%",
                    maxWidth: 760,
                    margin: "0 auto",
                  }}
                >
                  {[
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
                  ].map((item, index) => (
                    <div
                      key={item.label}
                      style={{
                        padding: "18px 18px 20px",
                        minHeight: 92,
                        borderRadius: 16,
                        background: "#ffffff",
                        border: "1px solid #e8e8e8",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        ...revealStyle(12 + index * 3, 10, 0.985),
                        boxShadow: "0 6px 18px rgba(0,0,0,0.03)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color: "rgba(0,0,0,0.28)",
                          fontFamily: "var(--font-geist-mono), monospace",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        [ {item.label} ]
                      </div>
                      <div
                        style={{
                          fontSize: 24,
                          fontWeight: 600,
                          color: item.tone,
                          fontFamily: "var(--font-geist-mono), monospace",
                          letterSpacing: "-0.02em",
                          lineHeight: 1,
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {!submittedLead ? (
              <div
                style={{
                  ...sectionStyle,
                  textAlign: "left",
                  padding: 18,
                  ...revealStyle(18, 16, 1),
                  maxWidth: 720,
                  width: "100%",
                  margin: "0 auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginBottom: 12,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 600,
                      color: "#262626",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    Contact details
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "rgba(0,0,0,0.58)",
                      lineHeight: 1.5,
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    Add an email and optional social handle.
                  </p>
                </div>
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
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: 12,
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Email</label>
                      <input
                        value={email}
                        onChange={(e) => {
                          setEmailAction(e.target.value);
                          setEmailErrorAction("");
                        }}
                        placeholder="agent@company.com"
                        style={{
                          ...inputStyle,
                          width: "100%",
                          borderColor: emailError ? "#dc2626" : "#e8e8e8",
                        }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>X Handle</label>
                      <input
                        value={xHandle}
                        onChange={(e) => {
                          setXHandleAction(e.target.value);
                          setXHandleErrorAction("");
                        }}
                        placeholder="@handle"
                        style={{
                          ...inputStyle,
                          width: "100%",
                          borderColor: xHandleError ? "#dc2626" : "#e8e8e8",
                        }}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>GitHub</label>
                      <input
                        value={github}
                        readOnly
                        style={{
                          ...inputStyle,
                          width: "100%",
                          color: "rgba(0,0,0,0.45)",
                          background: "#f7f7f7",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>CTF Flag (Optional)</label>
                    <input
                      value={flag}
                      onChange={(e) => setFlagAction(e.target.value)}
                      placeholder="flag{...}"
                      style={{ ...inputStyle, width: "100%" }}
                    />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 10,
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
              </div>
            ) : (
              <div
                style={{
                  ...sectionStyle,
                  padding: 20,
                  background: "rgba(26,147,56,0.04)",
                  borderColor: "rgba(26,147,56,0.18)",
                  color: "#1a9338",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 18,
                  ...revealStyle(18, 16, 1),
                  maxWidth: 720,
                  width: "100%",
                  margin: "0 auto",
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
                  <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>
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
                    marginTop: 4,
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
              </div>
            )}
          </div>
        </div>
      )}
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
