"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { isClientDevMode } from "../lib/myEnv";
import { clientFetch } from "../lib/client-identity";
import { COLORS } from "../lib/theme";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { L3_MARKDOWN_COMPONENTS } from "./level3MarkdownComponents";

const ROUND_DURATION_L3_MS = 120_000;
const LEVEL3_STATUS_STORAGE_KEY = "cheetcode.level3Status";

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
  initialCode?: string;
  onCodeChange?: (code: string) => void;
  onFinishAction: (results: Level3FinishResult) => void;
};

function extensionForLanguage(language: string): string {
  if (language === "Rust") return "rs";
  if (language === "C++") return "cpp";
  if (language === "C") return "c";
  return "txt";
}

function editorExtensionFor(language: string) {
  if (language === "Rust") return rust();
  return cpp();
}

export function Level3Game({
  sessionId,
  github,
  challenge,
  expiresAt,
  initialCode,
  onCodeChange,
  onFinishAction,
}: Level3GameProps) {
  const canAutoSolve = isClientDevMode();
  const [code, setCode] = useState(initialCode ?? challenge.starterCode);
  const [now, setNow] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [localCorrect, setLocalCorrect] = useState<Record<string, boolean | null>>({});
  const [leftPaneWidth, setLeftPaneWidth] = useState(48);
  const [editorHeightRatio, setEditorHeightRatio] = useState(0.75);
  const lockedTimeElapsedMsRef = useRef<number | null>(null);
  const autoSubmittedRef = useRef(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const verticalDragStateRef = useRef<{ startY: number; startRatio: number } | null>(null);
  const initialCodeRef = useRef(initialCode ?? challenge.starterCode);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    initialCodeRef.current = initialCode ?? challenge.starterCode;
  }, [initialCode, challenge.starterCode]);

  useEffect(() => {
    setCode(initialCodeRef.current);
    if (typeof window === "undefined") {
      setLocalCorrect({});
      setCompileError(null);
    } else {
      try {
        const raw = window.localStorage.getItem(LEVEL3_STATUS_STORAGE_KEY);
        const persisted = raw
          ? (JSON.parse(raw) as Record<
              string,
              { localCorrect: Record<string, boolean | null>; compileError: string | null }
            >)
          : {};
        setLocalCorrect(persisted[sessionId]?.localCorrect ?? {});
        setCompileError(persisted[sessionId]?.compileError ?? null);
      } catch {
        setLocalCorrect({});
        setCompileError(null);
      }
    }
    lockedTimeElapsedMsRef.current = null;
    autoSubmittedRef.current = false;
  }, [challenge.id, challenge.starterCode, sessionId]);

  useEffect(() => {
    onCodeChange?.(code);
  }, [code, onCodeChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LEVEL3_STATUS_STORAGE_KEY);
      const persisted = raw
        ? (JSON.parse(raw) as Record<
            string,
            { localCorrect: Record<string, boolean | null>; compileError: string | null }
          >)
        : {};
      persisted[sessionId] = { localCorrect, compileError };
      window.localStorage.setItem(LEVEL3_STATUS_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Ignore local persistence failures.
    }
  }, [compileError, localCorrect, sessionId]);

  const timeLeftMs = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progress = Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_L3_MS) * 100));
  const solvedLocal = useMemo(
    () => Object.values(localCorrect).filter((v) => v === true).length,
    [localCorrect],
  );
  const totalChecks = challenge.checks.length;
  const timeUp = timeLeftMs === 0;
  const editorExtensions = useMemo(
    () => [editorExtensionFor(challenge.language)],
    [challenge.language],
  );

  async function runChecks() {
    setIsChecking(true);
    setCompileError(null);
    setSubmitError(null);
    try {
      const res = await clientFetch("/api/validate-l3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, challengeId: challenge.id, code }),
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
      for (const result of data.results as Array<{
        problemId: string;
        correct: boolean;
        message?: string;
      }>) {
        nextState[result.problemId] = result.correct;
      }
      setLocalCorrect(nextState);
    } catch (err) {
      console.error("Level 3 check failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Test run failed. Please try again.");
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
    if (timeUp && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      void finishGame();
    }
  }, [timeUp, finishGame]);

  useEffect(() => {
    function onMove(event: MouseEvent) {
      if (dragStateRef.current) {
        const deltaX = event.clientX - dragStateRef.current.startX;
        const nextWidth = dragStateRef.current.startWidth + (deltaX / window.innerWidth) * 100;
        setLeftPaneWidth(Math.max(30, Math.min(70, nextWidth)));
      }
      if (verticalDragStateRef.current) {
        const deltaY = event.clientY - verticalDragStateRef.current.startY;
        const nextRatio = verticalDragStateRef.current.startRatio + deltaY / window.innerHeight;
        setEditorHeightRatio(Math.max(0.45, Math.min(0.85, nextRatio)));
      }
    }

    function onUp() {
      dragStateRef.current = null;
      verticalDragStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

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
            display: "flex",
            gap: 0,
          }}
        >
          <div
            style={{
              width: `${leftPaneWidth}%`,
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

            <div
              className="l3-spec-markdown"
              style={{
                marginTop: 14,
                fontSize: 14,
                lineHeight: 1.72,
                color: COLORS.TEXT_DARK,
              }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={L3_MARKDOWN_COMPONENTS}>
                {challenge.spec}
              </ReactMarkdown>
            </div>
          </div>

          <div
            onMouseDown={(event) => {
              dragStateRef.current = { startX: event.clientX, startWidth: leftPaneWidth };
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
            style={{
              width: 14,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "col-resize",
            }}
          >
            <div
              style={{
                width: 4,
                height: 64,
                borderRadius: 999,
                background:
                  "linear-gradient(180deg, rgba(250,93,25,0.1) 0%, rgba(250,93,25,0.45) 50%, rgba(250,93,25,0.1) 100%)",
              }}
            />
          </div>

          <div
            style={{
              width: `${100 - leftPaneWidth}%`,
              background: "#fff",
              border: "1px solid #e5e5e5",
              borderRadius: 12,
              padding: 14,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", margin: 0 }}>
              Paste code for <strong>main.{extensionForLanguage(challenge.language)}</strong>
            </p>

            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: editorHeightRatio,
                  minHeight: 0,
                  border: "1px solid rgba(250, 93, 25, 0.16)",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fffaf7",
                }}
              >
                <div
                  style={{
                    height: 34,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 12px",
                    borderBottom: "1px solid rgba(250, 93, 25, 0.16)",
                    background: "linear-gradient(180deg, #fff3eb 0%, #fffaf7 100%)",
                    color: "rgba(0,0,0,0.62)",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  <span>main.{extensionForLanguage(challenge.language)}</span>
                  <span>{challenge.language}</span>
                </div>
                <CodeMirror
                  className="l3-code-editor"
                  value={code}
                  height="100%"
                  editable={!(timeUp || isSubmitting)}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    autocompletion: false,
                    highlightActiveLine: true,
                  }}
                  extensions={editorExtensions}
                  onChange={(value) => setCode(value)}
                  style={{
                    height: "calc(100% - 34px)",
                    fontSize: 13,
                  }}
                />
              </div>

              <div
                onMouseDown={(event) => {
                  verticalDragStateRef.current = {
                    startY: event.clientY,
                    startRatio: editorHeightRatio,
                  };
                  document.body.style.cursor = "row-resize";
                  document.body.style.userSelect = "none";
                }}
                style={{
                  height: 12,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "row-resize",
                }}
              >
                <div
                  style={{
                    width: 84,
                    height: 4,
                    borderRadius: 999,
                    background:
                      "linear-gradient(90deg, rgba(250,93,25,0.1) 0%, rgba(250,93,25,0.45) 50%, rgba(250,93,25,0.1) 100%)",
                  }}
                />
              </div>

              <div
                style={{
                  flex: 1 - editorHeightRatio,
                  minHeight: 0,
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  overflowY: "auto",
                }}
              >
                {compileError && (
                  <p style={{ fontSize: 12, color: "#dc2626", margin: 10 }}>
                    Compile error: {compileError}
                  </p>
                )}
                {submitError && (
                  <p style={{ fontSize: 12, color: "#dc2626", margin: 10 }}>{submitError}</p>
                )}
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
    </div>
  );
}
