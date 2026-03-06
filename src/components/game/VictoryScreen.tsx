"use client";

import React, { useEffect, useState } from "react";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { VictoryDecor } from "@/components/game/decor";

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

export function VictoryScreen({
  results,
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

  useEffect(() => {
    const timer = setTimeout(() => setPhase("reveal"), 2400);
    return () => clearTimeout(timer);
  }, []);

  const inputStyle: React.CSSProperties = {
    height: 48,
    padding: "0 16px",
    boxSizing: "border-box",
    borderRadius: 12,
    border: "1px solid #e8e8e8",
    fontSize: 14,
    fontFamily: "var(--font-geist-mono), monospace",
    outline: "none",
    background: "#ffffff",
    color: "#262626",
    transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
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
        padding: "40px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <VictoryDecor />

      {phase === "enter" && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            animation: "victory-pulse 2s cubic-bezier(0.25, 0.1, 0.25, 1)",
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
              fontSize: 24,
              fontWeight: 600,
              color: "#fa5d19",
              letterSpacing: "0.2em",
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
            }}
          >
            Mission Complete
          </h1>
        </div>
      )}

      {phase === "reveal" && (
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            position: "relative",
            zIndex: 10,
            animation: "victory-reveal 0.8s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
            opacity: 0,
            transform: "translateY(20px)",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 24,
              padding: "40px",
              textAlign: "center",
            }}
          >
            <div style={{ marginBottom: 32 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 12px",
                  background: "rgba(250,93,25,0.1)",
                  borderRadius: 999,
                  marginBottom: 16,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fa5d19" }} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#fa5d19",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  Clearance Granted
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 48,
                  fontWeight: 600,
                  color: "#262626",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                }}
              >
                Agent Certified
              </h1>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 40,
              }}
            >
              <div
                style={{
                  padding: "16px",
                  background: "#f9f9f9",
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(0,0,0,0.4)",
                    fontFamily: "var(--font-geist-mono), monospace",
                    textTransform: "uppercase",
                  }}
                >
                  Final Score
                </span>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: "#fa5d19",
                    fontFamily: "var(--font-geist-mono), monospace",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {results.elo.toLocaleString()}
                </span>
              </div>
              <div
                style={{
                  padding: "16px",
                  background: "#f9f9f9",
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(0,0,0,0.4)",
                    fontFamily: "var(--font-geist-mono), monospace",
                    textTransform: "uppercase",
                  }}
                >
                  Global Rank
                </span>
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 600,
                    color: "#262626",
                    fontFamily: "var(--font-geist-mono), monospace",
                    letterSpacing: "-0.02em",
                  }}
                >
                  #{results.rank}
                </span>
              </div>
            </div>

            {!submittedLead ? (
              <div style={{ textAlign: "left" }}>
                <p
                  style={{
                    fontSize: 14,
                    color: "#262626",
                    fontWeight: 500,
                    marginBottom: 16,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  Print your credentials to finalize certification.
                </p>
                {submitError && (
                  <div
                    style={{
                      marginBottom: 16,
                      padding: "10px",
                      background: "rgba(220,38,38,0.05)",
                      borderRadius: 8,
                      color: "#dc2626",
                      fontSize: 13,
                    }}
                  >
                    {submitError}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 6,
                          fontFamily: "var(--font-geist-mono), monospace",
                          textTransform: "uppercase",
                        }}
                      >
                        Email
                      </label>
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
                      <label
                        style={{
                          display: "block",
                          fontSize: 11,
                          fontWeight: 500,
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 6,
                          fontFamily: "var(--font-geist-mono), monospace",
                          textTransform: "uppercase",
                        }}
                      >
                        X Handle
                      </label>
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
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: 11,
                        fontWeight: 500,
                        color: "rgba(0,0,0,0.4)",
                        marginBottom: 6,
                        fontFamily: "var(--font-geist-mono), monospace",
                        textTransform: "uppercase",
                      }}
                    >
                      CTF Flag (Optional)
                    </label>
                    <input
                      value={flag}
                      onChange={(e) => setFlagAction(e.target.value)}
                      placeholder="flag{...}"
                      style={{ ...inputStyle, width: "100%" }}
                    />
                  </div>
                  <button
                    className="btn-heat"
                    onClick={submitLeadFormAction}
                    disabled={!email.trim()}
                    style={{
                      width: "100%",
                      height: 48,
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 500,
                      marginTop: 8,
                      opacity: !email.trim() ? 0.5 : 1,
                      cursor: !email.trim() ? "not-allowed" : "pointer",
                    }}
                  >
                    Issue Credentials
                  </button>
                  <button
                    onClick={resetAllAction}
                    style={{
                      width: "100%",
                      height: 40,
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 500,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(0,0,0,0.3)",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.6)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(0,0,0,0.3)")}
                  >
                    RETRY MISSION
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "32px",
                  background: "rgba(26,147,56,0.05)",
                  borderRadius: 16,
                  color: "#1a9338",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
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
                  <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600 }}>
                    Credentials Issued
                  </h3>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: 14 }}>
                    Welcome to the agency. We&apos;ll be in touch.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 12, width: "100%", marginTop: 16 }}>
                  <button
                    className="btn-heat"
                    onClick={shareScoreAction}
                    style={{ flex: 1, height: 44, borderRadius: 12, fontSize: 14 }}
                  >
                    Share Status
                  </button>
                  <button
                    onClick={resetAllAction}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 12,
                      fontSize: 14,
                      fontWeight: 500,
                      background: "rgba(0,0,0,0.05)",
                      border: "none",
                      cursor: "pointer",
                      color: "#262626",
                    }}
                  >
                    Replay
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes victory-reveal {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes victory-pulse {
          0% {
            transform: scale(0.9);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
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
