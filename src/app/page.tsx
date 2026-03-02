"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { LandingScreen } from "@/components/game/LandingScreen";
import { Level1Game } from "@/components/game/Level1Game";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { validateEmail, validateXHandle } from "@/lib/validation";
import { ROUND_DURATION_MS, ROUND_DURATION_SECONDS, PROBLEMS_PER_SESSION } from "@/lib/constants";
import { isClientDevMode } from "@/lib/myEnv";
import { clientFetch } from "@/lib/client-identity";

type Screen = "landing" | "level2-prereq" | "level3-prereq" | "playing" | "results";
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
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const [level3Preview, setLevel3Preview] = useState<{
    challengeId: string;
    taskName: string;
    language: string;
  } | null>(null);
  const [level3PreviewLoading, setLevel3PreviewLoading] = useState(false);
  const [level3PreviewError, setLevel3PreviewError] = useState<string | null>(null);
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
  }, [sessionId, results, isSubmitting, github, timeLeftMs, problems, codes, flag]);

  // Auto-submit when timer expires — manual SUBMIT button handles early finish
  useEffect(() => {
    if (screen === "playing" && currentLevel === 1 && timeLeftMs === 0) void finishGame();
  }, [timeLeftMs, screen, currentLevel, finishGame]);

  async function launchLevel(level: number, level3ChallengeId?: string) {
    if (!isAuthenticated) return;

    // In local dev, allow any level. In production, allow freshly earned progression
    // even if unlockedLevel query is briefly stale after finishing a round.
    const canPlayFromFreshResult =
      (level === 2 && currentLevel === 1 && !!results) ||
      (level === 3 && currentLevel === 2 && !!results);
    if (!isLocalDev && level > unlockedLevel && !canPlayFromFreshResult) return;

    setSubmitError(null);
    try {
      const res = await clientFetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ level, isDev: isLocalDev, level3ChallengeId }),
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
      setSubmitError(
        err instanceof Error ? err.message : "Failed to start game. Please try again.",
      );
    }
  }

  async function startGame(requestedLevel?: number) {
    const level = requestedLevel ?? 1;
    if (level === 2) {
      setPendingLevel(2);
      setScreen("level2-prereq");
      return;
    }
    if (level === 3) {
      setPendingLevel(3);
      setLevel3Preview(null);
      setLevel3PreviewError(null);
      setScreen("level3-prereq");
      return;
    }
    await launchLevel(level);
  }

  useEffect(() => {
    if (screen !== "level3-prereq") return;
    let cancelled = false;

    async function loadLevel3Preview() {
      setLevel3PreviewLoading(true);
      setLevel3PreviewError(null);
      try {
        const res = await clientFetch("/api/level3-preview", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to load Level 3 preview");
        }
        if (cancelled) return;
        setLevel3Preview({
          challengeId: data.challengeId,
          taskName: data.taskName,
          language: data.language,
        });
      } catch (err) {
        if (cancelled) return;
        setLevel3PreviewError(
          err instanceof Error ? err.message : "Failed to load Level 3 preview",
        );
      } finally {
        if (!cancelled) setLevel3PreviewLoading(false);
      }
    }

    void loadLevel3Preview();
    return () => {
      cancelled = true;
    };
  }, [screen]);

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
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit form. Please try again.",
      );
    }
  }

  function resetAll() {
    setScreen("landing");
    setPendingLevel(null);
    setLevel3Preview(null);
    setLevel3PreviewError(null);
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

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("copy failed:", err);
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

  if (screen === "level2-prereq") {
    const chromiumCloneCommand = `git clone https://github.com/chromium/chromium.git
cd chromium
git checkout 69c7c0a024efdc5bec0a9075e306e180b51e4278`;
    const firecrawlCommand = "npx -y firecrawl-cli@latest init --all --browser";
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(140deg, #fff7f2 0%, #fff 100%)",
          padding: 24,
          fontFamily: "'SF Mono', 'Fira Code', var(--font-geist-mono), monospace",
        }}
      >
        <div
          style={{
            width: "min(880px, 100%)",
            background: "#fff",
            border: "1px solid #ffd5c0",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 12px 30px rgba(250, 93, 25, 0.08)",
          }}
        >
          <h2 style={{ margin: 0, color: "#fa5d19", fontSize: 24, fontWeight: 800 }}>
            Before Level 2: Setup Chromium Access
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "rgba(0,0,0,0.7)" }}>
            Level 2 expects your agent to reason over Chromium source code. Choose one setup path
            (Option A or Option B):
          </p>
          <ol style={{ margin: "14px 0 0", paddingLeft: 20, fontSize: 13, color: "#262626" }}>
            <li>
              <strong>Option A:</strong> Clone Chromium locally so your agent can search the
              codebase directly.
            </li>
            <li>
              <strong>Option B:</strong> Use Firecrawl tooling with source.chromium.org for
              web-based exploration.
            </li>
          </ol>
          <div
            style={{
              marginTop: 14,
              background: "#fff7f2",
              border: "1px solid #ffd5c0",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: "rgba(0,0,0,0.7)" }}>
              If you choose Option A, run:
            </p>
            <pre
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "#262626",
                whiteSpace: "pre-wrap",
                background: "#fff",
                border: "1px solid #ffd5c0",
                borderRadius: 8,
                padding: "10px 12px",
                overflowX: "auto",
                position: "relative",
              }}
            >
              <button
                onClick={() => void copyToClipboard(chromiumCloneCommand)}
                className="btn-ghost"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                Copy
              </button>
              <code>{chromiumCloneCommand}</code>
            </pre>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(0,0,0,0.7)" }}>
              If you choose Option B, run:
            </p>
            <pre
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "#262626",
                whiteSpace: "pre-wrap",
                background: "#fff",
                border: "1px solid #ffd5c0",
                borderRadius: 8,
                padding: "10px 12px",
                overflowX: "auto",
                position: "relative",
              }}
            >
              <button
                onClick={() => void copyToClipboard(firecrawlCommand)}
                className="btn-ghost"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                Copy
              </button>
              <code>{firecrawlCommand}</code>
            </pre>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(0,0,0,0.7)" }}>
              Then search Chromium at: https://source.chromium.org
            </p>
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button
              className="btn-heat"
              onClick={() => void launchLevel(pendingLevel ?? 2)}
              style={{ height: 36, padding: "0 16px", borderRadius: 8, fontWeight: 700 }}
            >
              I&apos;m Ready, Start Level 2
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setPendingLevel(null);
                setScreen("landing");
              }}
              style={{ height: 36, padding: "0 16px", borderRadius: 8, fontWeight: 700 }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "level3-prereq") {
    const level3CompilerCommand =
      level3Preview?.language === "Rust"
        ? "rustc --version"
        : level3Preview?.language === "C++"
          ? "c++ --version"
          : level3Preview?.language === "C"
            ? "cc --version"
            : "cc --version\nc++ --version\nrustc --version";
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(140deg, #fff7f2 0%, #fff 100%)",
          padding: 24,
          fontFamily: "'SF Mono', 'Fira Code', var(--font-geist-mono), monospace",
        }}
      >
        <div
          style={{
            width: "min(760px, 100%)",
            background: "#fff",
            border: "1px solid #ffd5c0",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 12px 30px rgba(250, 93, 25, 0.08)",
          }}
        >
          <h2 style={{ margin: 0, color: "#fa5d19", fontSize: 24, fontWeight: 800 }}>
            Before Level 3: Compiler Readiness
          </h2>
          <p style={{ margin: "10px 0 0", fontSize: 13, color: "rgba(0,0,0,0.7)" }}>
            {level3PreviewLoading ? (
              "Loading your next Level 3 challenge details..."
            ) : level3Preview ? (
              <>
                Your next Level 3 challenge is <strong>{level3Preview.taskName}</strong> in{" "}
                <strong>{level3Preview.language}</strong>. Confirm your compiler is ready.
              </>
            ) : (
              <>
                Confirm you have a <strong>C</strong>, <strong>C++</strong>, or{" "}
                <strong>Rust</strong> compiler ready for the Level 3 systems challenge.
              </>
            )}
          </p>
          <div
            style={{
              marginTop: 14,
              background: "#fff7f2",
              border: "1px solid #ffd5c0",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 12, color: "rgba(0,0,0,0.7)" }}>
              Suggested local check:
            </p>
            <pre
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "#262626",
                whiteSpace: "pre-wrap",
                background: "#fff",
                border: "1px solid #ffd5c0",
                borderRadius: 8,
                padding: "10px 12px",
                overflowX: "auto",
                position: "relative",
              }}
            >
              <button
                onClick={() => void copyToClipboard(level3CompilerCommand)}
                className="btn-ghost"
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: "inherit",
                }}
              >
                Copy
              </button>
              <code>{level3CompilerCommand}</code>
            </pre>
          </div>
          {level3PreviewError && (
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "#dc2626" }}>
              {level3PreviewError}
            </p>
          )}
          <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
            <button
              className="btn-heat"
              onClick={() => void launchLevel(pendingLevel ?? 3, level3Preview?.challengeId)}
              disabled={level3PreviewLoading}
              style={{ height: 36, padding: "0 16px", borderRadius: 8, fontWeight: 700 }}
            >
              {level3PreviewLoading ? "Loading..." : "Compiler Ready, Start Level 3"}
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setPendingLevel(null);
                setScreen("landing");
              }}
              style={{ height: 36, padding: "0 16px", borderRadius: 8, fontWeight: 700 }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

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
