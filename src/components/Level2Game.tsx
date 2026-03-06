"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { isClientDevMode } from "../lib/myEnv";
import { clientFetch } from "../lib/client-identity";
import { FIRECRAWL_FLAME_SVG } from "./game/firecrawl-flame";
import { BrailleSpinner } from "./game/decor";

const ROUND_DURATION_L2_MS = 60_000;
const LEVEL2_STATUS_STORAGE_KEY = "cheetcode.level2Status";

type Level2Problem = {
  id: string;
  question: string;
  project?: Level2ProjectKey;
};

type Level2ProjectKey = "chromium" | "firefox" | "libreoffice" | "postgres";

const LEVEL2_PROJECT_META: Record<
  Level2ProjectKey,
  { label: string; commit: string; color: string }
> = {
  chromium: {
    label: "Chromium",
    commit: "69c7c0a024",
    color: "#4285f4",
  },
  firefox: {
    label: "Firefox",
    commit: "22d04b52b0",
    color: "#ff7139",
  },
  libreoffice: {
    label: "LibreOffice",
    commit: "05aabfc2db",
    color: "#18a303",
  },
  postgres: {
    label: "PostgreSQL",
    commit: "f1baed18b",
    color: "#336791",
  },
};

function inferProjectFromProblemId(problemId: string): Level2ProjectKey | null {
  if (problemId.startsWith("l2_")) return "chromium";
  if (problemId.startsWith("ff_")) return "firefox";
  if (problemId.startsWith("lo_")) return "libreoffice";
  if (problemId.startsWith("pg_")) return "postgres";
  return null;
}

type Level2GameProps = {
  sessionId: Id<"sessions">;
  github: string;
  problems: Level2Problem[];
  expiresAt: number;
  initialAnswers?: Record<string, string>;
  onAnswersChangeAction?: (answers: Record<string, string>) => void;
  onFinishAction: (results: {
    elo: number;
    solved: number;
    rank: number;
    timeRemaining: number;
  }) => void;
};

export function Level2Game({
  sessionId,
  github,
  problems,
  expiresAt,
  initialAnswers,
  onAnswersChangeAction,
  onFinishAction,
}: Level2GameProps) {
  const canAutoSolve = isClientDevMode();
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
  const [now, setNow] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localCorrect, setLocalCorrect] = useState<Record<string, boolean | null>>({});
  const lockedTimeElapsedMsRef = useRef<number | null>(null);
  const autoSubmittedRef = useRef(false);
  const initialAnswersRef = useRef(initialAnswers ?? {});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    initialAnswersRef.current = initialAnswers ?? {};
  }, [initialAnswers]);

  useEffect(() => {
    lockedTimeElapsedMsRef.current = null;
    autoSubmittedRef.current = false;
    setAnswers(initialAnswersRef.current);
    if (typeof window === "undefined") {
      setLocalCorrect({});
      return;
    }
    try {
      const raw = window.localStorage.getItem(LEVEL2_STATUS_STORAGE_KEY);
      const persisted = raw
        ? (JSON.parse(raw) as Record<string, Record<string, boolean | null>>)
        : {};
      setLocalCorrect(persisted[sessionId] ?? {});
    } catch {
      setLocalCorrect({});
    }
  }, [sessionId]);

  useEffect(() => {
    onAnswersChangeAction?.(answers);
  }, [answers, onAnswersChangeAction]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LEVEL2_STATUS_STORAGE_KEY);
      const persisted = raw
        ? (JSON.parse(raw) as Record<string, Record<string, boolean | null>>)
        : {};
      persisted[sessionId] = localCorrect;
      window.localStorage.setItem(LEVEL2_STATUS_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Ignore local persistence failures.
    }
  }, [localCorrect, sessionId]);

  const timeLeftMs = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progress = Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_L2_MS) * 100));
  const solvedLocal = useMemo(
    () => Object.values(localCorrect).filter((v) => v === true).length,
    [localCorrect],
  );

  const sessionProjects = useMemo(() => {
    const discovered = new Set<Level2ProjectKey>();
    for (const problem of problems) {
      const key = problem.project ?? inferProjectFromProblemId(problem.id);
      if (key) discovered.add(key);
    }
    return [...discovered];
  }, [problems]);

  const timeUp = timeLeftMs === 0;

  const finishGame = useCallback(async () => {
    if (!sessionId || isSubmitting) return;
    if (lockedTimeElapsedMsRef.current === null) {
      lockedTimeElapsedMsRef.current = ROUND_DURATION_L2_MS - timeLeftMs;
    }
    const lockedTimeElapsedMs = lockedTimeElapsedMsRef.current;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const finishRes = await clientFetch("/api/finish-l2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          github,
          timeElapsed: lockedTimeElapsedMs,
          answers,
        }),
      });

      if (!finishRes.ok) {
        const errorData = await finishRes.json().catch(() => ({}));
        throw new Error(errorData.error || `finish failed: ${finishRes.status}`);
      }
      const d = await finishRes.json();
      onFinishAction(d);
    } catch (err) {
      console.error("Level 2 submission failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, github, answers, timeLeftMs, isSubmitting, onFinishAction]);

  useEffect(() => {
    if (timeUp && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      void finishGame();
    }
  }, [timeUp, finishGame]);

  async function checkAnswer(problemId: string) {
    const answer = answers[problemId] || "";
    if (!answer.trim()) return;

    setLocalCorrect((cur) => ({ ...cur, [problemId]: null }));
    setSubmitError(null);
    try {
      const res = await clientFetch("/api/validate-l2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, answers: { [problemId]: answer } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || "Validation failed");
        setLocalCorrect((cur) => ({ ...cur, [problemId]: false }));
        return;
      }
      const data = await res.json();
      const isCorrect =
        data.results.find((r: { problemId: string; correct: boolean }) => r.problemId === problemId)
          ?.correct || false;
      setLocalCorrect((cur) => ({ ...cur, [problemId]: isCorrect }));
    } catch (err) {
      console.error("Level 2 check failed:", err);
      setSubmitError("Network error during validation");
      setLocalCorrect((cur) => ({ ...cur, [problemId]: false }));
    }
  }

  async function autoSolve() {
    if (!canAutoSolve) return;
    try {
      const res = await clientFetch("/api/dev/auto-solve-l2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemIds: problems.map((p) => p.id) }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { answers: Record<string, string> };
      setAnswers((cur) => ({ ...cur, ...data.answers }));
      const nextCorrect: Record<string, boolean> = {};
      for (const id of Object.keys(data.answers)) nextCorrect[id] = true;
      setLocalCorrect((cur) => ({ ...cur, ...nextCorrect }));
    } catch {
      // no-op in dev helper
    }
  }

  const timerBg = secondsLeft <= 10 ? "#dc2626" : secondsLeft <= 20 ? "#fa5d19" : "#1a9338";
  const timerFg = timerBg;

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: "rgba(0,0,0,0.12)",
    fontFamily: "var(--font-geist-mono), monospace",
    fontWeight: 450,
    textTransform: "uppercase",
    letterSpacing: "0.02em",
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#f9f9f9",
        fontFamily: "var(--font-geist-mono), monospace",
        position: "relative",
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

      {/* ── Fixed Header ── */}
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
          <span style={{ fontSize: 13, fontWeight: 450, color: "#262626", letterSpacing: 0.3 }}>
            Firecrawl CTF
          </span>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.12)" }}>·</span>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.3)" }}>@{github}</span>
          {canAutoSolve && (
            <button
              onClick={() => void autoSolve()}
              style={{
                marginLeft: 4,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 450,
                background: "rgba(0,0,0,0.04)",
                color: "rgba(0,0,0,0.45)",
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              Auto Solve
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
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            LEVEL 2
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={labelStyle}>[ SOLVED ]</span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: solvedLocal === 10 ? "#1a9338" : "#262626",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {String(solvedLocal).padStart(2, "0")}
              <span style={{ color: "rgba(0,0,0,0.2)" }}> / 10</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={labelStyle}>[ TIME ]</span>
            <div
              style={{
                width: 120,
                height: 4,
                background: "#e8e8e8",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: timerBg,
                  transition: "width 100ms linear",
                }}
              />
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: timerFg,
                minWidth: 48,
                textAlign: "right",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {timeUp ? "TIME" : `0:${String(secondsLeft).padStart(2, "0")}`}
            </span>
          </div>
          <button
            onClick={() => void finishGame()}
            disabled={isSubmitting}
            className="btn-heat"
            style={{
              height: 32,
              padding: "0 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 450,
            }}
          >
            {isSubmitting ? "Submitting..." : "Finish & Submit"}
          </button>
        </div>
      </div>

      {/* ── Cocktail Sub-header ── */}
      <div
        style={{
          flexShrink: 0,
          background: "#ffffff",
          borderBottom: "1px solid #e8e8e8",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
          zIndex: 15,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(0,0,0,0.3)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          [ ACTIVE_COCKTAIL ]
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {sessionProjects.map((pKey) => {
            const meta = LEVEL2_PROJECT_META[pKey];
            return (
              <div
                key={pKey}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 12px",
                  background: "rgba(0,0,0,0.02)",
                  border: "1px solid #e8e8e8",
                  borderRadius: 10,
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }}
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#262626" }}>
                  {meta.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(0,0,0,0.3)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {meta.commit}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Problem list ── */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 16px 60px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          {problems.map((problem, idx) => {
            const status = localCorrect[problem.id];
            const borderColor =
              status === true ? "#22c55e" : status === false ? "#ef4444" : "#e8e8e8";
            const bgColor = status === true ? "#f0fdf4" : status === false ? "#fef2f2" : "#ffffff";
            const projectKey = problem.project ?? inferProjectFromProblemId(problem.id);
            const meta = projectKey ? LEVEL2_PROJECT_META[projectKey] : null;

            return (
              <div
                key={problem.id}
                style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 16,
                  transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flexShrink: 0, textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: meta?.color || "#fa5d19",
                        fontFamily: "var(--font-geist-mono), monospace",
                        marginBottom: 4,
                      }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    {meta && (
                      <div
                        title={meta.label}
                        style={{
                          width: 4,
                          height: 24,
                          borderRadius: 2,
                          background: meta.color,
                          margin: "0 auto",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
                      {meta && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: meta.color,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          [ {meta.label}_SYSTEM ]
                        </span>
                      )}
                      {status === true && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#1a9338",
                            textTransform: "uppercase",
                          }}
                        >
                          [ VERIFIED ]
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        color: "#262626",
                        margin: "0 0 16px",
                        lineHeight: 1.6,
                        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      }}
                    >
                      {problem.question}
                    </p>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input
                        type="text"
                        value={answers[problem.id] || ""}
                        onChange={(e) =>
                          setAnswers((cur) => ({ ...cur, [problem.id]: e.target.value }))
                        }
                        disabled={timeUp || status === true}
                        placeholder="Type solution..."
                        style={{
                          flex: 1,
                          height: 40,
                          padding: "0 14px",
                          fontSize: 13,
                          fontFamily: "var(--font-geist-mono), monospace",
                          border: "1px solid #e8e8e8",
                          borderRadius: 10,
                          background: status === true ? "#f0fdf4" : "#fafafa",
                          color: status === true ? "#1a9338" : "#262626",
                          outline: "none",
                          transition: "all 0.2s",
                        }}
                        onFocus={(e) => {
                          if (status !== true) e.target.style.borderColor = "#fa5d19";
                        }}
                        onBlur={(e) => {
                          if (status !== true) e.target.style.borderColor = "#e8e8e8";
                        }}
                      />
                      <button
                        onClick={() => checkAnswer(problem.id)}
                        disabled={timeUp || status === true || !(answers[problem.id] || "").trim()}
                        className={status === true ? "" : "btn-heat"}
                        style={{
                          height: 40,
                          padding: "0 20px",
                          borderRadius: 10,
                          border: status === true ? "none" : undefined,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor:
                            timeUp || status === true || !(answers[problem.id] || "").trim()
                              ? "not-allowed"
                              : "pointer",
                          background: status === true ? "rgba(26,147,56,0.08)" : undefined,
                          color: status === true ? "#1a9338" : undefined,
                        }}
                      >
                        {status === true
                          ? "Pass"
                          : status === false
                            ? "Retry"
                            : status === null
                              ? "..."
                              : "Check"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Overlays ── */}
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
              borderRadius: 24,
              padding: "48px 56px",
              border: "1px solid #e8e8e8",
              boxShadow: "0 24px 48px rgba(0,0,0,0.12)",
              maxWidth: 480,
            }}
          >
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
                color: solvedLocal === 10 ? "#1a9338" : "#262626",
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: -0.5,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              {isSubmitting ? "Submitting..." : solvedLocal === 10 ? "All Clear" : "Time\u2019s Up"}
            </p>
            <p
              style={{
                fontSize: 16,
                color: "rgba(0,0,0,0.4)",
                margin: "12px 0 0",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              <span style={labelStyle}>[ STATUS ]</span> {solvedLocal}/10 solved
            </p>
            {!isSubmitting && (
              <button
                onClick={() => void finishGame()}
                className="btn-heat"
                style={{
                  marginTop: 28,
                  padding: "12px 44px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                See Results
              </button>
            )}
            {isSubmitting && !submitError && (
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(0,0,0,0.3)",
                  marginTop: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <BrailleSpinner />
                <span>Synchronizing Cocktail results...</span>
              </div>
            )}
            {submitError && (
              <div style={{ marginTop: 24 }}>
                <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 16px" }}>{submitError}</p>
                <button
                  onClick={() => setSubmitError(null)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 10,
                    border: "1px solid #e8e8e8",
                    background: "rgba(0,0,0,0.04)",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Retry Connection
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
