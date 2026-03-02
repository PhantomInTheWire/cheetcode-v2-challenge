"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { LandingScreen } from "@/components/game/LandingScreen";
import { Level1Game } from "@/components/game/Level1Game";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { validateEmail, validateXHandle } from "@/lib/validation";
import {
  ROUND_DURATION_MS,
  ROUND_DURATION_SECONDS,
  PROBLEMS_PER_SESSION,
  SITE_URL,
} from "@/lib/constants";
import { isClientDevMode } from "@/lib/myEnv";
import { clientFetch } from "@/lib/client-identity";

type Screen = "landing" | "playing" | "results";
type ProblemTier = "easy" | "medium" | "hard" | "competitive";
type ProblemTestCase = {
  input: Record<string, unknown>;
  expected: unknown;
  args?: unknown[];
};
type GameProblem = {
  id: string;
  title: string;
  tier: ProblemTier;
  description: string;
  signature: string;
  starterCode: string;
  testCases: ProblemTestCase[];
};

type ExploitInfo = {
  id: string;
  bonus: number;
  message: string;
};

type LandmineInfo = {
  id: string;
  penalty: number;
  message: string;
};

type ResultsData = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  exploits?: ExploitInfo[];
  landmines?: LandmineInfo[];
  validation?: {
    compiled: boolean;
    error: string;
    results: Array<{ problemId: string; correct: boolean; message: string }>;
  };
};

const LEVEL2_TOTAL = 10;
const LEVEL3_TOTAL = 20;
const TOTAL_SOLVE_TARGET = PROBLEMS_PER_SESSION + LEVEL2_TOTAL + LEVEL3_TOTAL;

const MOBILE_BREAKPOINT = 900;
const Level2Game = dynamic(() => import("@/components/Level2Game").then((m) => m.Level2Game));
const Level3Game = dynamic(() => import("@/components/Level3Game").then((m) => m.Level3Game));

/** Original announcement tweet — every share quote-tweets this to amplify it. */
const ORIGINAL_TWEET_URL = "https://x.com/CalebPeffer/status/2024167056372097131";

/** True when viewport < 900px — gate gameplay on small screens */
function useIsMobile() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export default function Home() {
  // GitHub identity comes from OAuth session — no manual username input
  const { data: authSession, status: authStatus } = useSession();
  const github = authSession?.user?.githubUsername ?? "";
  const isAuthenticated = authStatus === "authenticated" && !!github;

  const [screen, setScreen] = useState<Screen>("landing");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [sessionId, setSessionId] = useState<Id<"sessions"> | null>(null);
  const [expiresAt, setExpiresAt] = useState(0);
  const [problems, setProblems] = useState<GameProblem[]>([]);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [localPass, setLocalPass] = useState<Record<string, boolean | null>>({});
  const [results, setResults] = useState<ResultsData | null>(null);
  const [email, setEmail] = useState("");
  const [xHandle, setXHandle] = useState("");
  const [flag, setFlag] = useState("");
  const [submittedLead, setSubmittedLead] = useState(false);
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lockedTimeElapsedMsRef = useRef<number | null>(null);
  // Inline validation error messages
  const [emailError, setEmailError] = useState("");
  const [xHandleError, setXHandleError] = useState("");
  // Worker removed — validation runs through /api/validate-l1 for parity with server
  const canAutoSolve = isClientDevMode();
  const isMobile = useIsMobile();

  // ── Convex hooks (read-only — all mutations go through authenticated API routes) ──
  const leaderboardQuery = useQuery(api.leaderboard.getAll);
  const leaderboard = useMemo(() => leaderboardQuery ?? [], [leaderboardQuery]);
  const displayedSolveTarget = useMemo(() => {
    const bestFromBoard = leaderboard.reduce(
      (max, row) => Math.max(max, row.solved),
      TOTAL_SOLVE_TARGET,
    );
    const bestFromSession = results ? Math.max(bestFromBoard, results.solved) : bestFromBoard;
    return Math.max(TOTAL_SOLVE_TARGET, bestFromSession);
  }, [leaderboard, results]);

  // ── Level progression state ──
  const unlockedLevel = useQuery(api.leaderboard.getMyLevel, { github: github || "" }) ?? 1;
  const isLocalDev = isClientDevMode();
  const [currentLevel, setCurrentLevel] = useState(1);
  const [l2Problems, setL2Problems] = useState<{ id: string; question: string }[]>([]);
  const [l3Challenge, setL3Challenge] = useState<{
    id: string;
    title: string;
    taskName: string;
    language: string;
    spec: string;
    checks: { id: string; name: string }[];
    starterCode: string;
  } | null>(null);

  // No worker — local validation uses the same QuickJS sandbox as final scoring
  // via /api/validate-l1 to guarantee parity between local and server checks

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const timeLeftMs = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progress = expiresAt
    ? Math.max(0, Math.min(100, (timeLeftMs / ROUND_DURATION_MS) * 100))
    : 0;
  const solvedLocal = useMemo(
    () => problems.filter((p) => localPass[p.id] === true).length,
    [problems, localPass],
  );
  const timeUp = screen === "playing" && timeLeftMs === 0;

  const finishGame = useCallback(async () => {
    if (!sessionId || results || isSubmitting) return;
    if (lockedTimeElapsedMsRef.current === null) {
      lockedTimeElapsedMsRef.current = ROUND_DURATION_MS - timeLeftMs;
    }
    const lockedTimeElapsedMs = lockedTimeElapsedMsRef.current;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await clientFetch("/api/finish-l1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          github,
          timeElapsed: lockedTimeElapsedMs,
          submissions: problems.map((p) => ({ problemId: p.id, code: codes[p.id] || "" })),
          flag: flag || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `finish failed: ${res.status}`);
      }
      const d = await res.json();
      setResults(d);
      setScreen("results");
    } catch (err) {
      console.error("submitResults failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, results, isSubmitting, github, timeLeftMs, problems, codes]);

  // Auto-submit when timer expires — manual SUBMIT button handles early finish
  useEffect(() => {
    if (screen === "playing" && currentLevel === 1 && timeLeftMs === 0) void finishGame();
  }, [timeLeftMs, screen, currentLevel, finishGame]);

  async function startGame(requestedLevel?: number) {
    if (!isAuthenticated) return;

    // Determine which level to play
    const level = requestedLevel ?? 1;
    // In local dev, allow any level. In production, enforce unlockedLevel.
    if (!isLocalDev && level > unlockedLevel) return;

    setSubmitError(null);
    try {
      const res = await clientFetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level, isDev: isLocalDev }),
      });
      if (!res.ok) throw new Error(`session creation failed: ${res.status}`);
      const d = await res.json();

      setCurrentLevel(d.level);
      setSessionId(d.sessionId);
      setExpiresAt(d.expiresAt);

      if (d.level === 2) {
        // Level 2: Set text problems
        setL2Problems(d.problems as { id: string; question: string }[]);
        setProblems([]);
        setL3Challenge(null);
      } else if (d.level === 3) {
        // Level 3: Set generated systems challenge
        const challenge = (
          d.problems as Array<{
            id: string;
            title: string;
            taskName: string;
            language: string;
            spec: string;
            checks: { id: string; name: string }[];
            starterCode: string;
          }>
        )[0];
        setL3Challenge(challenge);
        setProblems([]);
        setL2Problems([]);
      } else {
        // Level 1: Set code problems
        setProblems(d.problems as unknown as GameProblem[]);
        setCodes(
          Object.fromEntries(
            d.problems.map((p: { id: string; starterCode: string }) => [p.id, p.starterCode]),
          ),
        );
        setL2Problems([]);
        setL3Challenge(null);
      }

      setLocalPass({});
      setSubmittedLead(false);
      setResults(null);
      setIsSubmitting(false);
      lockedTimeElapsedMsRef.current = null;
      setScreen("playing");
    } catch (err) {
      console.error("createSession failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to start game. Please try again.");
    }
  }

  // Uses /api/validate-l1 (QuickJS WASM) so local checks match server scoring exactly
  async function runLocalCheck(problem: GameProblem) {
    setLocalPass((cur) => ({ ...cur, [problem.id]: null }));
    try {
      const res = await clientFetch("/api/validate-l1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: codes[problem.id] ?? problem.starterCode,
          testCases: problem.testCases,
        }),
      });
      const data = await res.json();
      setLocalPass((cur) => ({ ...cur, [problem.id]: data.passed === true }));
    } catch {
      setLocalPass((cur) => ({ ...cur, [problem.id]: false }));
    }
  }

  async function submitLeadForm() {
    if (!sessionId) return;
    const emailResult = validateEmail(email);
    const xResult = validateXHandle(xHandle);
    if (emailResult.ok === false) {
      setEmailError(emailResult.error);
      return;
    }
    if (xResult.ok === false) {
      setXHandleError(xResult.error);
      return;
    }
    setEmailError("");
    setXHandleError("");
    setSubmitError(null);

    try {
      const res = await clientFetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: emailResult.value,
          xHandle: xResult.value || undefined,
          flag,
          sessionId,
        }),
      });
      if (!res.ok) throw new Error(`lead submission failed: ${res.status}`);
      setSubmittedLead(true);
    } catch (err) {
      console.error("submitLead failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Failed to submit form. Please try again.");
    }
  }

  function resetAll() {
    setScreen("landing");
    setSessionId(null);
    setExpiresAt(0);
    setProblems([]);
    setL2Problems([]);
    setL3Challenge(null);
    setCodes({});
    setLocalPass({});
    setResults(null);
    setEmail("");
    setXHandle("");
    setFlag("");
    setSubmittedLead(false);
    setEmailError("");
    setXHandleError("");
    lockedTimeElapsedMsRef.current = null;
  }

  async function shareScore() {
    if (!results) return;
    const text = `I just scored ${results.elo.toLocaleString()} (rank #${results.rank}) on CheetCode CTF — ${PROBLEMS_PER_SESSION} problems, ${ROUND_DURATION_SECONDS} seconds. Think your agent can beat it? 🔥`;
    // Include tweet URL in the text body — X auto-renders it as a quote tweet
    const fullText = `${text}\n\n${ORIGINAL_TWEET_URL}`;
    const tweetUrl = `https://x.com/intent/post?text=${encodeURIComponent(fullText)}`;
    await navigator.clipboard.writeText(fullText);
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
  }

  async function autoSolve() {
    if (!sessionId || !canAutoSolve) return;
    setIsAutoSolving(true);
    try {
      // Auto-solve uses a local API route (dev-only) — pass problem IDs directly
      const r = await clientFetch("/api/dev/auto-solve-l1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemIds: problems.map((p) => p.id) }),
      });
      if (!r.ok) return;
      const d = (await r.json()) as {
        solutions: Record<string, string>;
      };
      setCodes((cur) => ({ ...cur, ...d.solutions }));

      const solvedIds = problems.map((p) => p.id).filter((id) => Boolean(d.solutions[id]?.trim()));

      if (solvedIds.length > 0) {
        setLocalPass((cur) => {
          const next = { ...cur };
          for (const id of solvedIds) next[id] = null;
          return next;
        });
      }

      const items = problems
        .map((p) => ({ problemId: p.id, code: d.solutions[p.id] ?? "", testCases: p.testCases }))
        .filter((x) => x.code.trim().length > 0);

      if (items.length > 0) {
        const vRes = await clientFetch("/api/validate-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items }),
        });

        if (vRes.ok) {
          const vData = (await vRes.json()) as {
            results: Record<string, { passed: boolean; error?: string }>;
          };
          setLocalPass((cur) => {
            const next = { ...cur };
            for (const p of problems) {
              const r = vData.results?.[p.id];
              if (r) {
                next[p.id] = r.passed === true;
              } else if (d.solutions[p.id]?.trim()) {
                next[p.id] = null;
              }
            }
            return next;
          });
        } else {
          const outcomes = await Promise.all(
            problems.map(async (p) => {
              const code = d.solutions[p.id];
              if (!code?.trim()) return [p.id, null] as const;
              try {
                const single = await clientFetch("/api/validate-l1", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ code, testCases: p.testCases }),
                });
                if (!single.ok) return [p.id, null] as const;
                const singleData = await single.json();
                return [p.id, singleData.passed === true] as const;
              } catch {
                return [p.id, null] as const;
              }
            }),
          );

          setLocalPass((cur) => {
            const next = { ...cur };
            for (const [id, passed] of outcomes) {
              if (passed !== null) next[id] = passed;
            }
            return next;
          });
        }
      }
    } finally {
      setIsAutoSolving(false);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     MOBILE GATE — <900px gets leaderboard only, no game
     ═══════════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9f9f9",
          padding: "60px 24px",
          fontFamily: "var(--font-geist-mono), monospace",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 48, marginBottom: 20 }}>🔥</span>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#fa5d19", margin: "0 0 12px" }}>
          FIRECRAWL CTF
        </h1>
        <p style={{ fontSize: 22, fontWeight: 700, color: "#262626", margin: "0 0 8px" }}>
          Play on your computer
        </p>
        <p style={{ fontSize: 14, color: "rgba(0,0,0,0.45)", maxWidth: 360, margin: "0 0 36px" }}>
          This challenge requires a full-sized screen. Open it on your desktop or laptop to play.
        </p>

        <LeaderboardTable
          rows={leaderboard}
          totalSolveTarget={TOTAL_SOLVE_TARGET}
          displayedSolveTarget={displayedSolveTarget}
        />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     LANDING
     ═══════════════════════════════════════════════════════════ */
  if (screen === "landing") {
    return (
      <LandingScreen
        isAuthenticated={isAuthenticated}
        github={github}
        authStatus={authStatus}
        authSession={authSession}
        showLeaderboard={showLeaderboard}
        setShowLeaderboard={setShowLeaderboard}
        unlockedLevel={unlockedLevel}
        isLocalDev={isLocalDev}
        startGame={startGame}
        leaderboard={leaderboard}
        TOTAL_SOLVE_TARGET={TOTAL_SOLVE_TARGET}
        displayedSolveTarget={displayedSolveTarget}
        submitError={submitError}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════
     PLAYING — 5×5 grid, all {PROBLEMS_PER_SESSION} problems visible
     ═══════════════════════════════════════════════════════════ */
  if (screen === "playing") {
    // Level 2: Render the separate Level2Game component
    if (currentLevel === 2) {
      return (
        <Level2Game
          sessionId={sessionId!}
          github={github}
          problems={l2Problems}
          expiresAt={expiresAt}
          onFinishAction={(results) => {
            setResults(results);
            setScreen("results");
          }}
        />
      );
    }

    if (currentLevel === 3 && l3Challenge) {
      return (
        <Level3Game
          sessionId={sessionId!}
          github={github}
          challenge={l3Challenge}
          expiresAt={expiresAt}
          onFinishAction={(results) => {
            setResults(results);
            setScreen("results");
          }}
        />
      );
    }

    // Level 1 Game UI
    const timerBg = secondsLeft <= 10 ? "#dc2626" : secondsLeft <= 20 ? "#fa5d19" : "#1a9338";
    const timerFg = secondsLeft <= 10 ? "#dc2626" : secondsLeft <= 20 ? "#fa5d19" : "#1a9338";

    return (
      <Level1Game
        github={github}
        canAutoSolve={canAutoSolve}
        autoSolve={autoSolve}
        isAutoSolving={isAutoSolving}
        solvedLocal={solvedLocal}
        progress={progress}
        timerBg={timerBg}
        timerFg={timerFg}
        timeUp={timeUp}
        secondsLeft={secondsLeft}
        finishGame={finishGame}
        isSubmitting={isSubmitting}
        submitError={submitError}
        problems={problems}
        localPass={localPass}
        codes={codes}
        setCodes={setCodes}
        runLocalCheck={runLocalCheck}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RESULTS
     ═══════════════════════════════════════════════════════════ */
  /* ═══════════════════════════════════════════════════════════
     RESULTS
     ═══════════════════════════════════════════════════════════ */
  if (results) {
    return (
      <ResultsScreen
        results={results}
        displayedSolveTarget={displayedSolveTarget}
        currentLevel={currentLevel}
        unlockedLevel={unlockedLevel}
        github={github}
        email={email}
        setEmail={setEmail}
        xHandle={xHandle}
        setXHandle={setXHandle}
        flag={flag}
        setFlag={setFlag}
        emailError={emailError}
        setEmailError={setEmailError}
        xHandleError={xHandleError}
        setXHandleError={setXHandleError}
        submitError={submitError}
        submittedLead={submittedLead}
        submitLeadForm={submitLeadForm}
        shareScore={shareScore}
        resetAll={resetAll}
        startGame={startGame}
      />
    );
  }

  return null;
}
