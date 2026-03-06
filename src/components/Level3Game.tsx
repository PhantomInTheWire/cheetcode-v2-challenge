"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { isClientDevMode } from "../lib/myEnv";
import { clientFetch } from "../lib/client-identity";
import { COLORS } from "../lib/theme";
import { FIRECRAWL_FLAME_SVG } from "./game/firecrawl-flame";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { L3_MARKDOWN_COMPONENTS } from "./level3MarkdownComponents";

const ROUND_DURATION_L3_MS = 120_000;
const LEVEL3_STATUS_STORAGE_KEY = "cheetcode.level3Status";
const LEVEL3_RUN_SMOKE_CHECKS = 5;
const LEVEL3_RUN_DEBOUNCE_MS = 350;
const LEVEL3_RUN_CACHE_TTL_MS = 90_000;
const LEVEL3_CACHED_BADGE_MS = 1_200;
const LEVEL3_PHASE_SWAP_MS = 700;

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
  expiresAt?: number;
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
  onCodeChangeAction?: (code: string) => void;
  onExpiresAtChangeAction?: (expiresAt: number) => void;
  onFinishAction: (results: Level3FinishResult) => void;
};

type Level3ValidationRow = {
  problemId: string;
  correct: boolean;
  message?: string;
};

type Level3ValidationPayload = {
  compiled: boolean;
  error: string;
  staleSession?: boolean;
  expiresAt?: number;
  results: Level3ValidationRow[];
};

type L3RunCacheEntry = {
  at: number;
  response: Level3ValidationPayload;
};

type RunUiPhase = "idle" | "compiling" | "running" | "cached";

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

async function hashText(input: string): Promise<string> {
  if (typeof window !== "undefined" && window.crypto?.subtle) {
    const hashBuffer = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(input),
    );
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Fallback for environments without Web Crypto.
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function Level3Game({
  sessionId,
  github,
  challenge,
  expiresAt,
  initialCode,
  onCodeChangeAction,
  onExpiresAtChangeAction,
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
  const [runUiPhase, setRunUiPhase] = useState<RunUiPhase>("idle");
  const [runHint, setRunHint] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [pulseFrame, setPulseFrame] = useState(0);
  const [leftPaneWidth, setLeftPaneWidth] = useState(48);
  const [editorHeightRatio, setEditorHeightRatio] = useState(0.75);
  const lockedTimeElapsedMsRef = useRef<number | null>(null);
  const pausedDurationMsRef = useRef(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const autoSubmittedRef = useRef(false);
  const dragStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const verticalDragStateRef = useRef<{ startY: number; startRatio: number } | null>(null);
  const initialCodeRef = useRef(initialCode ?? challenge.starterCode);
  const runCacheRef = useRef<Map<string, L3RunCacheEntry>>(new Map());
  const runInFlightRef = useRef(false);
  const runDebounceUntilRef = useRef(0);
  const runPhaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runCachedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRunPhaseTimer = useCallback(() => {
    if (runPhaseTimerRef.current) {
      clearTimeout(runPhaseTimerRef.current);
      runPhaseTimerRef.current = null;
    }
  }, []);
  const clearRunCachedTimer = useCallback(() => {
    if (runCachedTimerRef.current) {
      clearTimeout(runCachedTimerRef.current);
      runCachedTimerRef.current = null;
    }
  }, []);
  const clearRunHintTimer = useCallback(() => {
    if (runHintTimerRef.current) {
      clearTimeout(runHintTimerRef.current);
      runHintTimerRef.current = null;
    }
  }, []);

  const showRunHint = useCallback(
    (message: string, ttlMs = 900) => {
      setRunHint(message);
      clearRunHintTimer();
      runHintTimerRef.current = setTimeout(() => {
        setRunHint(null);
        runHintTimerRef.current = null;
      }, ttlMs);
    },
    [clearRunHintTimer],
  );

  const setRunPhaseIdle = useCallback(() => {
    clearRunPhaseTimer();
    setRunUiPhase("idle");
  }, [clearRunPhaseTimer]);

  const setRunPhaseCached = useCallback(() => {
    clearRunPhaseTimer();
    clearRunCachedTimer();
    setRunUiPhase("cached");
    runCachedTimerRef.current = setTimeout(() => {
      setRunUiPhase("idle");
      runCachedTimerRef.current = null;
    }, LEVEL3_CACHED_BADGE_MS);
  }, [clearRunCachedTimer, clearRunPhaseTimer]);

  const applySmokeResults = useCallback((data: Level3ValidationPayload) => {
    const nextState: Record<string, boolean | null> = {};
    for (const result of data.results.slice(0, LEVEL3_RUN_SMOKE_CHECKS)) {
      nextState[result.problemId] = result.correct;
    }
    setLocalCorrect(nextState);
  }, []);

  const applyValidationForRun = useCallback(
    (data: Level3ValidationPayload) => {
      if (data.compiled === false) {
        setCompileError(data.error || "compile failed");
        if (data.staleSession === true) {
          throw new Error(data.error || "stale Level 3 session");
        }
      }
      if (typeof data.expiresAt === "number" && Number.isFinite(data.expiresAt)) {
        onExpiresAtChangeAction?.(data.expiresAt);
      }
      applySmokeResults(data);
    },
    [applySmokeResults, onExpiresAtChangeAction],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
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
    pausedDurationMsRef.current = 0;
    pauseStartedAtRef.current = null;
    autoSubmittedRef.current = false;
    runCacheRef.current.clear();
    runInFlightRef.current = false;
    runDebounceUntilRef.current = 0;
    clearRunPhaseTimer();
    clearRunCachedTimer();
    clearRunHintTimer();
    setRunHint(null);
    setRunUiPhase("idle");
  }, [
    challenge.id,
    challenge.starterCode,
    clearRunCachedTimer,
    clearRunHintTimer,
    clearRunPhaseTimer,
    sessionId,
  ]);

  useEffect(() => {
    onCodeChangeAction?.(code);
  }, [code, onCodeChangeAction]);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPrefersReducedMotion(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if ((!isChecking && !isSubmitting) || prefersReducedMotion) return;
    const id = setInterval(() => {
      setPulseFrame((value) => (value + 1) % 8);
    }, 120);
    return () => clearInterval(id);
  }, [isChecking, isSubmitting, prefersReducedMotion]);

  useEffect(() => {
    const isBusy = isChecking || isSubmitting;
    if (isBusy) {
      if (pauseStartedAtRef.current === null) {
        pauseStartedAtRef.current = Date.now();
      }
      return;
    }
    if (pauseStartedAtRef.current !== null) {
      pausedDurationMsRef.current += Date.now() - pauseStartedAtRef.current;
      pauseStartedAtRef.current = null;
    }
  }, [isChecking, isSubmitting]);

  useEffect(() => {
    return () => {
      clearRunPhaseTimer();
      clearRunCachedTimer();
      clearRunHintTimer();
    };
  }, [clearRunCachedTimer, clearRunHintTimer, clearRunPhaseTimer]);

  const timeLeftMs = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progress = Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_L3_MS) * 100));
  const solvedLocal = useMemo(
    () => Object.values(localCorrect).filter((v) => v === true).length,
    [localCorrect],
  );
  const totalChecks = challenge.checks.length;
  const timeUp = timeLeftMs === 0;
  const timerPaused = isChecking || isSubmitting;
  const sourceExtension = useMemo(
    () => extensionForLanguage(challenge.language),
    [challenge.language],
  );
  const editorExtensions = useMemo(
    () => [editorExtensionFor(challenge.language)],
    [challenge.language],
  );
  const brailleSpinner = prefersReducedMotion
    ? ["\u2026"]
    : ["\u28FE", "\u28FD", "\u28FB", "\u28BF", "\u287F", "\u28DF", "\u28EF", "\u28F7"];
  const spinnerGlyph = brailleSpinner[pulseFrame % brailleSpinner.length] ?? "\u28FE";
  const handleCodeChange = useCallback((value: string) => {
    setCode(value);
  }, []);
  const renderedSpec = useMemo(
    () => (
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={L3_MARKDOWN_COMPONENTS}>
        {challenge.spec}
      </ReactMarkdown>
    ),
    [challenge.spec],
  );
  const renderedEditor = useMemo(
    () => (
      <CodeMirror
        className="l3-code-editor"
        value={code}
        height="100%"
        editable={!(timeUp || isSubmitting || isChecking)}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          autocompletion: false,
          highlightActiveLine: true,
        }}
        extensions={editorExtensions}
        onChange={handleCodeChange}
        style={{
          height: "calc(100% - 34px)",
          fontSize: 13,
        }}
      />
    ),
    [code, editorExtensions, handleCodeChange, isSubmitting, timeUp],
  );
  const pulseGlyphs = prefersReducedMotion ? ["."] : [".", "o", "O", "@"];
  const pulseGlyph = pulseGlyphs[pulseFrame % pulseGlyphs.length] ?? ".";
  const isRunBusy = runUiPhase === "compiling" || runUiPhase === "running";
  const runButtonLabel =
    runUiPhase === "compiling"
      ? "Compiling\u2026"
      : runUiPhase === "running"
        ? "Running\u2026"
        : "Run";

  async function runChecks() {
    const nowMs = Date.now();
    if (runInFlightRef.current) {
      showRunHint("Already running...");
      return;
    }
    if (runDebounceUntilRef.current > nowMs) {
      return;
    }
    runDebounceUntilRef.current = nowMs + LEVEL3_RUN_DEBOUNCE_MS;

    runInFlightRef.current = true;
    setIsChecking(true);
    setCompileError(null);
    setSubmitError(null);
    clearRunCachedTimer();
    setRunHint(null);
    setRunUiPhase("compiling");
    clearRunPhaseTimer();
    runPhaseTimerRef.current = setTimeout(() => {
      setRunUiPhase((current) => (current === "compiling" ? "running" : current));
      runPhaseTimerRef.current = null;
    }, LEVEL3_PHASE_SWAP_MS);
    let keepCachedPhase = false;
    try {
      const codeHash = await hashText(code);
      const cacheKey = `${sessionId}:${challenge.id}:${codeHash}`;
      const cached = runCacheRef.current.get(cacheKey);
      if (cached && nowMs - cached.at <= LEVEL3_RUN_CACHE_TTL_MS) {
        applyValidationForRun(cached.response);
        setRunPhaseCached();
        keepCachedPhase = true;
        return;
      }

      const res = await clientFetch("/api/validate-l3", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, challengeId: challenge.id, code }),
      });
      const data = (await res.json()) as Level3ValidationPayload;
      if (!res.ok) {
        throw new Error(data.error || `validation failed: ${res.status}`);
      }
      runCacheRef.current.set(cacheKey, { at: Date.now(), response: data });
      applyValidationForRun(data);
    } catch (err) {
      console.error("Level 3 check failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Test run failed. Please try again.");
    } finally {
      runInFlightRef.current = false;
      setIsChecking(false);
      if (!keepCachedPhase) {
        setRunPhaseIdle();
      }
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
      if (typeof data.expiresAt === "number" && Number.isFinite(data.expiresAt)) {
        onExpiresAtChangeAction?.(data.expiresAt);
      }
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
  }, [sessionId, github, timeLeftMs, isSubmitting, onExpiresAtChangeAction, onFinishAction, code]);

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
        fontFamily: "var(--font-geist-mono), monospace",
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
          position: "relative",
          zIndex: 10,
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
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
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
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            LEVEL 3
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "rgba(0,0,0,0.35)",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              Passed
            </span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: solvedLocal === totalChecks ? "#1a9338" : "#262626",
                fontFamily: "var(--font-geist-mono), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {solvedLocal}
              <span style={{ color: "rgba(0,0,0,0.2)" }}>/ {totalChecks}</span>
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 160,
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
                  borderRadius: 4,
                  transition: "width 100ms linear, background 500ms",
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
                transition: "color 500ms",
                fontFamily: "var(--font-geist-mono), monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {timeUp
                ? "TIME"
                : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
            </span>
            {timerPaused && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: "#8a3d14",
                  background: "rgba(250, 93, 25, 0.12)",
                  border: "1px solid rgba(250, 93, 25, 0.25)",
                  borderRadius: 999,
                  padding: "4px 8px",
                  letterSpacing: 0.2,
                  whiteSpace: "nowrap",
                }}
              >
                Timer paused
              </span>
            )}
          </div>

          <button
            onClick={() => void runChecks()}
            disabled={isSubmitting || timeUp || !code.trim()}
            className={`btn-ghost${isRunBusy ? " btn-ghost-busy" : ""}`}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 450,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              cursor: isSubmitting || timeUp ? "not-allowed" : "pointer",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                position: "relative",
                zIndex: 2,
              }}
            >
              <span>{runButtonLabel}</span>
              {isRunBusy && (
                <span
                  style={{
                    fontSize: 11,
                    minWidth: 10,
                    textAlign: "center",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                  aria-hidden="true"
                >
                  {spinnerGlyph}
                </span>
              )}
            </span>
          </button>
          {runHint && (
            <span
              style={{
                fontSize: 10,
                color: "rgba(0,0,0,0.5)",
                marginLeft: -8,
                whiteSpace: "nowrap",
              }}
            >
              {runHint}
            </span>
          )}
          {runUiPhase === "cached" && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: "#8a3d14",
                background: "rgba(250, 93, 25, 0.12)",
                border: "1px solid rgba(250, 93, 25, 0.25)",
                borderRadius: 999,
                padding: "4px 8px",
                letterSpacing: 0.2,
                whiteSpace: "nowrap",
              }}
            >
              Instant (cached)
            </span>
          )}

          <button
            onClick={() => void finishGame()}
            disabled={isSubmitting}
            className={`btn-heat${isSubmitting ? " btn-heat-busy" : ""}`}
            style={{
              height: 32,
              padding: "0 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 450,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              letterSpacing: 0.3,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isSubmitting ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span>Submitting…</span>
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-geist-mono), monospace",
                    minWidth: 10,
                  }}
                  aria-hidden="true"
                >
                  {spinnerGlyph}
                </span>
              </span>
            ) : (
              "Submit"
            )}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: 12, position: "relative", zIndex: 1 }}>
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
              border: "1px solid #e8e8e8",
              borderRadius: 12,
              padding: 14,
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "rgba(0,0,0,0.5)",
                margin: 0,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              <strong style={{ fontWeight: 500 }}>Level 3:</strong> {challenge.taskName}
            </p>
            <p
              style={{
                fontSize: 11,
                color: "rgba(0,0,0,0.35)",
                margin: "4px 0 0",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              Assigned language: <strong style={{ fontWeight: 500 }}>{challenge.language}</strong> •
              submit one flat file
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
              {renderedSpec}
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
              border: "1px solid #e8e8e8",
              borderRadius: 12,
              padding: 14,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <p style={{ fontSize: 12, color: "rgba(0,0,0,0.5)", margin: 0 }}>
              Paste code for <strong>main.{sourceExtension}</strong>
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
                    fontWeight: 500,
                  }}
                >
                  <span>main.{sourceExtension}</span>
                  <span>{challenge.language}</span>
                </div>
                {renderedEditor}
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
                  border: "1px solid #e8e8e8",
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
                        <div
                          style={{
                            color: "#262626",
                            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                          }}
                        >
                          {check.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 500,
                            fontFamily: "var(--font-geist-mono), monospace",
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
