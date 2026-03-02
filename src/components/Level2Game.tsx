"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { isClientDevMode } from "../lib/myEnv";

const ROUND_DURATION_L2_MS = 45_000;

type Level2Problem = {
  id: string;
  question: string;
};

type Level2GameProps = {
  sessionId: Id<"sessions">;
  github: string;
  problems: Level2Problem[];
  expiresAt: number;
  onFinish: (results: { elo: number; solved: number; rank: number; timeRemaining: number }) => void;
  onReset: () => void;
};

export function Level2Game({ sessionId, github, problems, expiresAt, onFinish, onReset }: Level2GameProps) {
  const canAutoSolve = isClientDevMode();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localCorrect, setLocalCorrect] = useState<Record<string, boolean | null>>({});
  const lockedTimeElapsedMsRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    lockedTimeElapsedMsRef.current = null;
  }, [sessionId]);

  const timeLeftMs = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progress = Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_L2_MS) * 100));
  const solvedLocal = useMemo(
    () => Object.values(localCorrect).filter((v) => v === true).length,
    [localCorrect]
  );
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
      // Validate all answers via API
      const validateRes = await fetch("/api/validate-l2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      
      if (!validateRes.ok) throw new Error(`validation failed: ${validateRes.status}`);
      const validateData = await validateRes.json();
      
      // Count correct answers
      const correctIds = validateData.results
        .filter((r: { correct: boolean }) => r.correct)
        .map((r: { problemId: string }) => r.problemId);

      // Submit results
      const finishRes = await fetch("/api/finish-l2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          github,
          timeElapsed: lockedTimeElapsedMs,
          solvedProblemIds: correctIds,
        }),
      });
      
      if (!finishRes.ok) {
        const errorData = await finishRes.json().catch(() => ({}));
        throw new Error(errorData.error || `finish failed: ${finishRes.status}`);
      }
      const d = await finishRes.json();
      onFinish(d);
    } catch (err) {
      console.error("Level 2 submission failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, github, answers, timeLeftMs, isSubmitting, onFinish]);

  // Auto-submit when timer expires
  useEffect(() => {
    if (timeUp) void finishGame();
  }, [timeUp, finishGame]);

  async function checkAnswer(problemId: string) {
    const answer = answers[problemId] || "";
    if (!answer.trim()) return;
    
    setLocalCorrect((cur) => ({ ...cur, [problemId]: null }));
    try {
      const res = await fetch("/api/validate-l2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers: { [problemId]: answer } }),
      });
      const data = await res.json();
      const isCorrect = data.results.find((r: { problemId: string; correct: boolean }) => r.problemId === problemId)?.correct || false;
      setLocalCorrect((cur) => ({ ...cur, [problemId]: isCorrect }));
    } catch {
      setLocalCorrect((cur) => ({ ...cur, [problemId]: false }));
    }
  }

  async function autoSolve() {
    if (!canAutoSolve) return;
    try {
      const res = await fetch("/api/dev/auto-solve-l2", {
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
  const timerFg = secondsLeft <= 10 ? "#dc2626" : secondsLeft <= 20 ? "#fa5d19" : "#1a9338";

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
      {/* Header bar */}
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
              onClick={() => void autoSolve()}
              style={{
                marginLeft: 8,
                padding: "2px 10px",
                fontSize: 10,
                fontWeight: 600,
                background: "#f3f3f3",
                color: "rgba(0,0,0,0.5)",
                border: "1px solid #e5e5e5",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ⚡ Auto Solve
            </button>
          )}
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              background: "rgba(250, 93, 25, 0.15)",
              color: "#fa5d19",
              borderRadius: 4,
              fontWeight: 600,
              marginLeft: 8,
            }}
          >
            LEVEL 2
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Solved */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,0,0,0.35)", textTransform: "uppercase" }}>
              Solved
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: solvedLocal === 10 ? "#1a9338" : "#262626" }}>
              {solvedLocal}<span style={{ color: "rgba(0,0,0,0.25)" }}>/10</span>
            </span>
          </div>
          {/* Timer */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 140, height: 5, background: "#e5e5e5", borderRadius: 4, overflow: "hidden" }}>
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
                ...(secondsLeft <= 10 ? { animation: "timer-pulse 0.6s ease-in-out infinite" } : {}),
              }}
            >
              {timeUp ? "TIME" : `0:${String(secondsLeft).padStart(2, "0")}`}
            </span>
          </div>
          {/* Submit button */}
          <button
            onClick={() => void finishGame()}
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
            }}
          >
            {isSubmitting ? "SUBMITTING..." : "FINISH & SUBMIT"}
          </button>
        </div>
      </div>

      {/* Problem list */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
        }}
      >
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", margin: 0 }}>
              <strong>Level 2:</strong> Chromium Search Challenge
            </p>
            <p style={{ fontSize: 11, color: "rgba(0,0,0,0.4)", margin: "4px 0 0" }}>
              Target: Chromium commit 69c7c0a024efdc5bec0a9075e306e180b51e4278
            </p>
          </div>

          {problems.map((problem, idx) => {
            const status = localCorrect[problem.id];
            const borderColor = status === true ? "#22c55e" : status === false ? "#ef4444" : "#e5e5e5";
            const bgColor = status === true ? "#f0fdf4" : status === false ? "#fef2f2" : "#ffffff";

            return (
              <div
                key={problem.id}
                style={{
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                  transition: "all 300ms",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fa5d19",
                      minWidth: 28,
                    }}
                  >
                    #{idx + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: "#262626", margin: "0 0 12px", lineHeight: 1.5 }}>
                      {problem.question}
                    </p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={answers[problem.id] || ""}
                        onChange={(e) =>
                          setAnswers((cur) => ({ ...cur, [problem.id]: e.target.value }))
                        }
                        disabled={timeUp || status === true}
                        placeholder="Enter your answer..."
                        style={{
                          flex: 1,
                          height: 36,
                          padding: "0 12px",
                          fontSize: 13,
                          fontFamily: "inherit",
                          border: "1px solid #e5e5e5",
                          borderRadius: 6,
                          background: status === true ? "#f0fdf4" : "#fafafa",
                          color: status === true ? "#1a9338" : "#262626",
                          outline: "none",
                        }}
                      />
                      <button
                        onClick={() => checkAnswer(problem.id)}
                        disabled={timeUp || status === true || !(answers[problem.id] || "").trim()}
                        style={{
                          height: 36,
                          padding: "0 16px",
                          borderRadius: 6,
                          border: "none",
                          fontSize: 12,
                          fontWeight: 600,
                          fontFamily: "inherit",
                          cursor:
                            timeUp || status === true || !(answers[problem.id] || "").trim()
                              ? "not-allowed"
                              : "pointer",
                          background: status === true ? "rgba(26,147,56,0.1)" : "#fa5d19",
                          color: status === true ? "#1a9338" : "#fff",
                        }}
                      >
                        {status === true ? "✓ CORRECT" : status === false ? "✗ RETRY" : "CHECK"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Time's up / submitting overlay */}
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
                color: solvedLocal === 10 ? "#1a9338" : "#dc2626",
                margin: 0,
              }}
            >
              {isSubmitting ? "SUBMITTING..." : solvedLocal === 10 ? "ALL CLEAR 🔥" : "TIME'S UP"}
            </p>
            <p style={{ fontSize: 22, color: "rgba(0,0,0,0.45)", margin: "8px 0 0" }}>
              {solvedLocal}/10 solved
            </p>
            {!isSubmitting && (
              <button
                onClick={() => void finishGame()}
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
            {isSubmitting && !submitError && (
              <p style={{ fontSize: 14, color: "rgba(0,0,0,0.35)", marginTop: 20 }}>
                Validating your answers...
              </p>
            )}
            {submitError && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: 14, color: "#dc2626", margin: "0 0 12px" }}>
                  {submitError}
                </p>
                <button
                  onClick={() => setSubmitError(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    border: "1px solid #e5e5e5",
                    background: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
