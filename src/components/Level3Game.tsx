"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { isClientDevMode } from "../lib/myEnv";
import { clientFetch } from "../lib/client-identity";

const ROUND_DURATION_L3_MS = 120_000;

type Level3Check = {
  id: string;
  name: string;
};

type Level3Challenge = {
  id: string;
  title: string;
  taskName: string;
  language: string;
  spec: string;
  checks: Level3Check[];
  starterCode: string;
};

type Level3FinishResult = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  validation?: {
    compiled: boolean;
    error: string;
    results: Array<{ problemId: string; correct: boolean; message: string }>;
  };
};

type Level3GameProps = {
  sessionId: Id<"sessions">;
  github: string;
  challenge: Level3Challenge;
  expiresAt: number;
  onFinishAction: (results: Level3FinishResult) => void;
};

function extensionForLanguage(language: string): string {
  if (language === "Rust") return "rs";
  if (language === "C++") return "cpp";
  if (language === "C") return "c";
  return "txt";
}

export function Level3Game({
  sessionId,
  github,
  challenge,
  expiresAt,
  onFinishAction,
}: Level3GameProps) {
  const canAutoSolve = isClientDevMode();
  const [code, setCode] = useState(challenge.starterCode);
  const [now, setNow] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [localCorrect, setLocalCorrect] = useState<Record<string, boolean | null>>({});
  const lockedTimeElapsedMsRef = useRef<number | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setCode(challenge.starterCode);
    setLocalCorrect({});
    setCompileError(null);
    lockedTimeElapsedMsRef.current = null;
  }, [challenge.id, challenge.starterCode]);

  const timeLeftMs = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progress = Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_L3_MS) * 100));
  const solvedLocal = useMemo(
    () => Object.values(localCorrect).filter((v) => v === true).length,
    [localCorrect],
  );
  const totalChecks = challenge.checks.length;
  const timeUp = timeLeftMs === 0;

  async function runChecks(): Promise<string[]> {
    setIsChecking(true);
    setCompileError(null);
    try {
      const res = await clientFetch("/api/validate-l3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `validation failed: ${res.status}`);
      }
      if (data.compiled === false) {
        setCompileError(data.error || "compile failed");
        if (data.staleSession === true) {
          throw new Error(data.error || "stale Level 3 session");
        }
      }

      const nextState: Record<string, boolean | null> = {};
      const correctIds: string[] = [];
      for (const result of data.results as Array<{
        problemId: string;
        correct: boolean;
        message?: string;
      }>) {
        nextState[result.problemId] = result.correct;
        if (result.correct) correctIds.push(result.problemId);
      }
      setLocalCorrect(nextState);
      return correctIds;
    } finally {
      setIsChecking(false);
    }
  }

  async function autoSolve() {
    if (!canAutoSolve) return;
    try {
      const res = await clientFetch("/api/dev/auto-solve-l3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: challenge.id }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { code: string };
      if (data.code) setCode(data.code);
    } catch {
      // no-op in dev helper
    }
  }

  const finishGame = useCallback(async () => {
    if (!sessionId || isSubmitting) return;
    if (lockedTimeElapsedMsRef.current === null) {
      lockedTimeElapsedMsRef.current = ROUND_DURATION_L3_MS - timeLeftMs;
    }
    const lockedTimeElapsedMs = lockedTimeElapsedMsRef.current;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const finishRes = await clientFetch("/api/finish-l3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          github,
          timeElapsed: lockedTimeElapsedMs,
          code,
        }),
      });

      if (!finishRes.ok) {
        const errorData = await finishRes.json().catch(() => ({}));
        throw new Error(errorData.error || `finish failed: ${finishRes.status}`);
      }
      const data = (await finishRes.json()) as Level3FinishResult;
      if (data.validation?.results) {
        const nextState: Record<string, boolean | null> = {};
        for (const result of data.validation.results) {
          nextState[result.problemId] = result.correct;
        }
        setLocalCorrect(nextState);
      }
      onFinishAction(data);
    } catch (err) {
      console.error("Level 3 submission failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, github, timeLeftMs, isSubmitting, onFinishAction, code]);

  useEffect(() => {
    if (timeUp) void finishGame();
  }, [timeUp, finishGame]);

  const timerBg = secondsLeft <= 20 ? "#dc2626" : secondsLeft <= 45 ? "#fa5d19" : "#1a9338";
  const timerFg = secondsLeft <= 20 ? "#dc2626" : secondsLeft <= 45 ? "#fa5d19" : "#1a9338";

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
            LEVEL 3
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(0,0,0,0.35)",
                textTransform: "uppercase",
              }}
            >
              Passed
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: solvedLocal === totalChecks ? "#1a9338" : "#262626",
              }}
            >
              {solvedLocal}
              <span style={{ color: "rgba(0,0,0,0.25)" }}>/ {totalChecks}</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 160,
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
              }}
            >
              {timeUp
                ? "TIME"
                : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
            </span>
          </div>

          <button
            onClick={() => void runChecks()}
            disabled={isChecking || isSubmitting || timeUp || !code.trim()}
            className="btn-ghost"
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: isChecking || isSubmitting || timeUp ? "not-allowed" : "pointer",
            }}
          >
            {isChecking ? "RUNNING..." : "RUN TESTS"}
          </button>

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

      <div style={{ flex: 1, minHeight: 0, padding: 12 }}>
        <div
          style={{
            height: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 14,
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", margin: 0 }}>
              <strong>Level 3:</strong> {challenge.taskName}
            </p>
            <p style={{ fontSize: 11, color: "rgba(0,0,0,0.45)", margin: "4px 0 0" }}>
              Assigned language: <strong>{challenge.language}</strong> • submit one flat file
            </p>

            <pre
              style={{
                marginTop: 12,
                whiteSpace: "pre-wrap",
                fontSize: 12,
                lineHeight: 1.55,
                color: "#262626",
              }}
            >
              {challenge.spec}
            </pre>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 14,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", margin: 0 }}>
              Paste code for <strong>main.{extensionForLanguage(challenge.language)}</strong>
            </p>

            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              disabled={timeUp || isSubmitting}
              style={{
                flex: 1,
                minHeight: 260,
                width: "100%",
                resize: "none",
                background: "#fafafa",
                color: "#262626",
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                lineHeight: 1.45,
                fontFamily: "inherit",
                outline: "none",
              }}
            />

            {compileError && (
              <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>
                Compile error: {compileError}
              </p>
            )}
            {submitError && (
              <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>{submitError}</p>
            )}

            <div
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {challenge.checks.map((check) => {
                const status = localCorrect[check.id];
                return (
                  <div
                    key={check.id}
                    style={{
                      padding: "8px 10px",
                      borderBottom: "1px solid #f0f0f0",
                      fontSize: 12,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ color: "#262626" }}>{check.name}</div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            status === true
                              ? "#1a9338"
                              : status === false
                                ? "#dc2626"
                                : "rgba(0,0,0,0.4)",
                        }}
                      >
                        {status === true ? "PASS" : status === false ? "FAIL" : "PENDING"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
