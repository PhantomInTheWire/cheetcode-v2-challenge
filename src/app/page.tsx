"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LeaderboardTable } from "@/components/LeaderboardTable";
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
  const lockedTimeElapsedMsRef = useRef<number | null>(null);
  // Inline validation error messages
  const [emailError, setEmailError] = useState("");
  const [xHandleError, setXHandleError] = useState("");
  // Worker removed — validation runs through /api/validate for parity with server
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
  // via /api/validate to guarantee parity between local and server checks

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
    try {
      // Call our Next.js API route which validates with QuickJS (in-process)
      // then updates Convex leaderboard — no cross-origin issues
      const res = await clientFetch("/api/finish-l1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          github,
          timeElapsed: lockedTimeElapsedMs,
          submissions: problems.map((p) => ({
            problemId: p.id,
            code: codes[p.id] ?? "",
          })),
        }),
      });
      if (!res.ok) throw new Error(`finish failed: ${res.status}`);
      const d = await res.json();
      setResults(d);
      setScreen("results");
    } catch (err) {
      console.error("submitResults failed:", err);
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
    }
  }

  // Uses /api/validate (QuickJS WASM) so local checks match server scoring exactly
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
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#f9f9f9",
          padding: "80px 24px",
          fontFamily: "var(--font-geist-mono), monospace",
        }}
      >
        <div style={{ width: "100%", maxWidth: 600, textAlign: "center" }}>
          {/* Logo */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 40 }}>🔥</span>
              <h1
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: "#fa5d19",
                  margin: 0,
                  letterSpacing: -1,
                }}
              >
                FIRECRAWL CTF
              </h1>
            </div>
            <a
              href={SITE_URL}
              style={{
                fontSize: 12,
                color: "rgba(0,0,0,0.3)",
                marginTop: 6,
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              cheetcode-ctf.firecrawl.dev
            </a>
          </div>

          {/* Headline card */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              padding: "48px 40px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <p
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: "#262626",
                margin: 0,
                lineHeight: 1.1,
                letterSpacing: -0.5,
              }}
            >
              {PROBLEMS_PER_SESSION} problems. {ROUND_DURATION_SECONDS} seconds.
            </p>
            <p
              style={{
                fontSize: 16,
                color: "rgba(0,0,0,0.45)",
                margin: "12px 0 0",
                fontWeight: 400,
              }}
            >
              Good luck.
            </p>
          </div>

          {/* Info chips */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 10,
              marginTop: 28,
            }}
          >
            {[
              `Solve all ${PROBLEMS_PER_SESSION} coding challenges`,
              `You have ${ROUND_DURATION_SECONDS} seconds`,
              `That's ${(ROUND_DURATION_SECONDS / PROBLEMS_PER_SESSION).toFixed(1)} seconds per problem`,
            ].map((t) => (
              <span
                key={t}
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e5e5",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  color: "rgba(0,0,0,0.45)",
                }}
              >
                {t}
              </span>
            ))}
          </div>

          {/* Auth + Start card */}
          <div
            style={{
              maxWidth: 420,
              margin: "36px auto 0",
              background: "#ffffff",
              border: "1px solid #e5e5e5",
              borderRadius: 16,
              padding: "28px 32px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            {authStatus === "loading" && (
              <p style={{ fontSize: 13, color: "rgba(0,0,0,0.4)", textAlign: "center" }}>
                Loading...
              </p>
            )}

            {authStatus === "unauthenticated" && (
              <>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: "rgba(0,0,0,0.4)",
                    marginBottom: 12,
                    textAlign: "center",
                  }}
                >
                  Sign in to play — your GitHub identity is your scoreboard entry
                </p>
                <button
                  onClick={() => signIn("github")}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    background: "#24292f",
                    color: "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#1b1f23")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#24292f")}
                >
                  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                  </svg>
                  Sign in with GitHub
                </button>
              </>
            )}

            {isAuthenticated && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {authSession.user.image && (
                      <Image
                        src={authSession.user.image}
                        alt=""
                        width={32}
                        height={32}
                        style={{ borderRadius: "50%", border: "1px solid #e5e5e5" }}
                      />
                    )}
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#262626", margin: 0 }}>
                        @{github}
                      </p>
                      <p style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", margin: 0 }}>
                        Verified via GitHub OAuth
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => signOut()}
                    style={{
                      fontSize: 11,
                      color: "rgba(0,0,0,0.35)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontFamily: "inherit",
                    }}
                  >
                    sign out
                  </button>
                </div>
                {/* Level selection */}
                {unlockedLevel < 2 && !isLocalDev ? (
                  <button
                    onClick={() => startGame(1)}
                    className="btn-heat"
                    style={{
                      width: "100%",
                      height: 52,
                      borderRadius: 12,
                      fontSize: 17,
                      fontWeight: 800,
                      letterSpacing: 2,
                      fontFamily: "inherit",
                    }}
                  >
                    START
                  </button>
                ) : unlockedLevel < 3 && !isLocalDev ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => startGame(1)}
                      className="btn-heat"
                      style={{
                        flex: 1,
                        height: 52,
                        borderRadius: 12,
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: 2,
                        fontFamily: "inherit",
                      }}
                    >
                      PLAY LEVEL 1
                    </button>
                    <button
                      onClick={() => startGame(2)}
                      className="btn-heat"
                      style={{
                        flex: 1,
                        height: 52,
                        borderRadius: 12,
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: 2,
                        fontFamily: "inherit",
                      }}
                    >
                      PLAY LEVEL 2
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => startGame(1)}
                      className="btn-heat"
                      style={{
                        flex: 1,
                        height: 52,
                        borderRadius: 12,
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: 2,
                        fontFamily: "inherit",
                      }}
                    >
                      PLAY LEVEL 1
                    </button>
                    <button
                      onClick={() => startGame(2)}
                      className="btn-heat"
                      style={{
                        flex: 1,
                        height: 52,
                        borderRadius: 12,
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: 2,
                        fontFamily: "inherit",
                      }}
                    >
                      PLAY LEVEL 2
                    </button>
                    <button
                      onClick={() => startGame(3)}
                      className="btn-heat"
                      style={{
                        flex: 1,
                        height: 52,
                        borderRadius: 12,
                        fontSize: 17,
                        fontWeight: 800,
                        letterSpacing: 2,
                        fontFamily: "inherit",
                      }}
                    >
                      PLAY LEVEL 3
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Leaderboard toggle */}
          <button
            onClick={() => setShowLeaderboard((c) => !c)}
            style={{
              display: "block",
              margin: "28px auto 0",
              background: "none",
              border: "none",
              color: "rgba(0,0,0,0.4)",
              fontSize: 13,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 4,
              fontFamily: "inherit",
            }}
          >
            {showLeaderboard ? "hide leaderboard" : "view leaderboard"}
          </button>

          {showLeaderboard && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
              <LeaderboardTable
                rows={leaderboard}
                totalSolveTarget={TOTAL_SOLVE_TARGET}
                displayedSolveTarget={displayedSolveTarget}
              />
            </div>
          )}
        </div>
      </div>
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

    // Level 1: Original game UI
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
        {/* ── Header bar ── */}
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
            <span style={{ fontSize: 11, color: "rgba(0,0,0,0.35)", marginLeft: 4 }}>
              @{github}
            </span>
            {canAutoSolve && (
              <button
                onClick={autoSolve}
                disabled={isAutoSolving}
                style={{
                  marginLeft: 8,
                  padding: "2px 10px",
                  fontSize: 10,
                  fontWeight: 600,
                  background: "#f3f3f3",
                  color: "rgba(0,0,0,0.5)",
                  border: "1px solid #e5e5e5",
                  borderRadius: 4,
                  cursor: isAutoSolving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {isAutoSolving ? "solving..." : "⚡ Auto Solve"}
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {/* Solved */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "rgba(0,0,0,0.35)",
                  textTransform: "uppercase",
                }}
              >
                Solved
              </span>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: solvedLocal === 25 ? "#1a9338" : "#262626",
                }}
              >
                {solvedLocal}
                <span style={{ color: "rgba(0,0,0,0.25)" }}>/25</span>
              </span>
            </div>
            {/* Timer */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 140,
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
                  ...(secondsLeft <= 10
                    ? { animation: "timer-pulse 0.6s ease-in-out infinite" }
                    : {}),
                }}
              >
                {timeUp ? "TIME" : `0:${String(secondsLeft).padStart(2, "0")}`}
              </span>
            </div>
            {/* ── Big SUBMIT button ── */}
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

        {/* ── 5×2 Challenge Grid ── */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gridAutoRows: "minmax(560px, auto)",
            alignContent: "start",
            gap: 8,
            padding: 8,
            minHeight: 0,
            overflowY: "auto",
          }}
        >
          {problems.map((problem, idx) => {
            const status =
              problem.id in localPass
                ? localPass[problem.id] === null
                  ? "submitting"
                  : localPass[problem.id]
                    ? "passed"
                    : "failed"
                : "idle";

            const borderColor =
              status === "passed" ? "#22c55e" : status === "failed" ? "#ef4444" : "#e5e5e5";
            const bgColor =
              status === "passed" ? "#f0fdf4" : status === "failed" ? "#fef2f2" : "#ffffff";

            return (
              <div
                key={problem.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  borderRadius: 8,
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  transition: "all 300ms",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                }}
              >
                {/* Panel header */}
                <div
                  style={{
                    padding: "5px 8px",
                    borderBottom: "1px solid #f0f0f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 10, color: "rgba(0,0,0,0.3)" }}>#{idx + 1}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#262626",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 120,
                      }}
                    >
                      {problem.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      borderRadius: 999,
                      fontWeight: 600,
                      background:
                        problem.tier === "competitive"
                          ? "rgba(147, 51, 234, 0.10)"
                          : problem.tier === "hard"
                            ? "rgba(220,38,38,0.10)"
                            : problem.tier === "medium"
                              ? "rgba(180,83,9,0.10)"
                              : "rgba(26,147,56,0.10)",
                      color:
                        problem.tier === "competitive"
                          ? "#9333ea"
                          : problem.tier === "hard"
                            ? "#dc2626"
                            : problem.tier === "medium"
                              ? "#b45309"
                              : "#1a9338",
                    }}
                  >
                    {problem.tier}
                  </span>
                </div>

                {/* Description */}
                <div style={{ padding: "8px 10px", flexShrink: 0 }}>
                  <p style={{ fontSize: 10, color: "rgba(0,0,0,0.5)", lineHeight: 1.4, margin: 0 }}>
                    {problem.description.length > 520
                      ? problem.description.slice(0, 520) + "..."
                      : problem.description}
                  </p>
                </div>

                {/* Code textarea */}
                <div
                  style={{
                    flex: "1 1 auto",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                    padding: "0 10px",
                  }}
                >
                  <textarea
                    value={codes[problem.id] ?? ""}
                    onChange={(e) => setCodes((cur) => ({ ...cur, [problem.id]: e.target.value }))}
                    disabled={timeUp || status === "passed"}
                    placeholder={problem.signature}
                    spellCheck={false}
                    style={{
                      flex: "1 1 auto",
                      minHeight: 320,
                      width: "100%",
                      resize: "none",
                      background: "#fafafa",
                      color: status === "passed" ? "#1a9338" : "#262626",
                      border: "1px solid #e5e5e5",
                      borderRadius: 4,
                      padding: 6,
                      fontSize: 10,
                      lineHeight: 1.4,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Submit button */}
                <div style={{ padding: "5px 8px", flexShrink: 0 }}>
                  <button
                    onClick={() => runLocalCheck(problem)}
                    disabled={timeUp || status === "passed" || !(codes[problem.id] ?? "").trim()}
                    style={{
                      width: "100%",
                      padding: "4px 0",
                      borderRadius: 4,
                      border: "none",
                      fontSize: 10,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      cursor:
                        timeUp || status === "passed" || !(codes[problem.id] ?? "").trim()
                          ? "not-allowed"
                          : "pointer",
                      background:
                        status === "passed"
                          ? "rgba(26,147,56,0.1)"
                          : timeUp
                            ? "#e5e5e5"
                            : "#fa5d19",
                      color: status === "passed" ? "#1a9338" : timeUp ? "rgba(0,0,0,0.3)" : "#fff",
                      transition: "all 150ms",
                    }}
                  >
                    {status === "passed"
                      ? "✓ PASSED"
                      : status === "failed"
                        ? "✗ RETRY"
                        : status === "submitting"
                          ? "..."
                          : "SUBMIT"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Time's up / submitting overlay ── */}
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
                  color: solvedLocal === 25 ? "#1a9338" : "#dc2626",
                  margin: 0,
                }}
              >
                {isSubmitting ? "SUBMITTING..." : solvedLocal === 25 ? "ALL CLEAR 🔥" : "TIME'S UP"}
              </p>
              <p style={{ fontSize: 22, color: "rgba(0,0,0,0.45)", margin: "8px 0 0" }}>
                {solvedLocal}/25 solved locally
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
              {isSubmitting && (
                <p style={{ fontSize: 14, color: "rgba(0,0,0,0.35)", marginTop: 20 }}>
                  Validating your solutions on the server...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RESULTS
     ═══════════════════════════════════════════════════════════ */
  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 44,
    borderRadius: 10,
    border: "1px solid #e5e5e5",
    background: "#f3f3f3",
    padding: "0 16px",
    fontSize: 14,
    fontFamily: "var(--font-geist-mono), monospace",
    color: "#262626",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
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
        padding: "80px 24px",
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
      {results && (
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            background: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: 20,
            padding: "48px 44px",
            textAlign: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          {/* Headline */}
          <h2
            style={{
              fontSize: 44,
              fontWeight: 800,
              margin: 0,
              lineHeight: 1.1,
              color: results.solved >= TOTAL_SOLVE_TARGET ? "#fa5d19" : "#262626",
            }}
          >
            {results.solved <= 2 ? "TIME'S UP" : results.solved < 10 ? "NOT BAD" : "ALL CLEAR 🔥"}
          </h2>

          {results.solved <= 2 && (
            <p style={{ marginTop: 16, fontSize: 15, color: "rgba(0,0,0,0.45)" }}>
              You probably need a different approach.
            </p>
          )}
          {results.solved >= TOTAL_SOLVE_TARGET && (
            <p style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: "#fa5d19" }}>
              We want to talk to you.
            </p>
          )}

          {/* Stats row */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 0,
              marginTop: 36,
              background: "#f3f3f3",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {[
              {
                label: "Solved",
                value: `${results.solved}/${displayedSolveTarget}`,
                color: "#262626",
              },
              { label: "Score", value: results.elo.toLocaleString(), color: "#fa5d19" },
              { label: "Rank", value: `#${results.rank}`, color: "#262626" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                style={{
                  flex: 1,
                  padding: "20px 16px",
                  borderRight: i < 2 ? "1px solid #e5e5e5" : "none",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    color: "rgba(0,0,0,0.35)",
                    margin: 0,
                  }}
                >
                  {stat.label}
                </p>
                <p style={{ fontSize: 26, fontWeight: 800, color: stat.color, margin: "8px 0 0" }}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── Score Breakdown — always visible so players learn what's possible ── */}
          <div style={{ marginTop: 28, textAlign: "left" }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#262626",
                margin: "0 0 14px",
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              Score Breakdown
            </p>

            {/* Base score */}
            <div
              style={{
                background: "#f3f3f3",
                borderRadius: 10,
                padding: "14px 18px",
                marginBottom: 10,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "rgba(0,0,0,0.5)" }}>
                  Base score ({results.solved}/{displayedSolveTarget} solved,{" "}
                  {results.timeRemaining}s remaining)
                </span>
                <span style={{ fontWeight: 700, color: "#262626" }}>
                  {results.elo -
                    (results.exploits ?? []).reduce((s, e) => s + e.bonus, 0) -
                    (results.landmines ?? []).reduce((s, l) => s + l.penalty, 0)}
                </span>
              </div>
            </div>

            {/* ── Exploits — only visible if they found any ── */}
            {(results.exploits ?? []).length > 0 && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(250,93,25,0.2)",
                  overflow: "hidden",
                  marginBottom: 10,
                  background: "rgba(250,93,25,0.03)",
                }}
              >
                <div
                  style={{
                    padding: "10px 18px",
                    background: "rgba(250,93,25,0.06)",
                    borderBottom: "1px solid rgba(250,93,25,0.15)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fa5d19",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Exploits
                  </p>
                </div>
                {(results.exploits ?? []).map((e) => (
                  <div
                    key={e.id}
                    style={{
                      padding: "8px 18px",
                      borderBottom: "1px solid rgba(250,93,25,0.1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>
                      ✓
                    </span>
                    <span style={{ fontSize: 11, color: "#262626", flex: 1, lineHeight: 1.5 }}>
                      {e.message}
                    </span>
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: "#1a9338", flexShrink: 0 }}
                    >
                      +{e.bonus}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Landmines — only visible if they triggered any ── */}
            {(results.landmines ?? []).length > 0 && (
              <div
                style={{
                  borderRadius: 10,
                  border: "1px solid rgba(220,38,38,0.2)",
                  overflow: "hidden",
                  marginBottom: 10,
                  background: "rgba(220,38,38,0.03)",
                }}
              >
                <div
                  style={{
                    padding: "10px 18px",
                    background: "rgba(220,38,38,0.06)",
                    borderBottom: "1px solid rgba(220,38,38,0.15)",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#dc2626",
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Safety Issues
                  </p>
                </div>
                {(results.landmines ?? []).map((l) => (
                  <div
                    key={l.id}
                    style={{
                      padding: "8px 18px",
                      borderBottom: "1px solid rgba(220,38,38,0.1)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>
                      ✗
                    </span>
                    <span style={{ fontSize: 11, color: "#262626", flex: 1, lineHeight: 1.5 }}>
                      {l.message}
                    </span>
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", flexShrink: 0 }}
                    >
                      {l.penalty}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Final Score */}
            <div
              style={{
                background: "#262626",
                borderRadius: 10,
                padding: "14px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                Final Score
              </span>
              <span style={{ fontSize: 22, fontWeight: 800, color: "#fa5d19" }}>
                {results.elo.toLocaleString()}
              </span>
            </div>

            {currentLevel === 3 && results.validation && (
              <div
                style={{
                  marginTop: 14,
                  border: "1px solid #e5e5e5",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fafafa",
                }}
              >
                {(() => {
                  const passedCount = results.validation.results.filter((r) => r.correct).length;
                  const failedCount = Math.max(0, results.validation.results.length - passedCount);
                  return (
                    <>
                      <div
                        style={{
                          padding: "10px 18px",
                          borderBottom: "1px solid #e5e5e5",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#262626",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          Stage 3 Verification
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: results.validation.compiled ? "#1a9338" : "#dc2626",
                          }}
                        >
                          {passedCount}/{results.validation.results.length} checks passed
                        </span>
                      </div>
                      {!results.validation.compiled && (
                        <div
                          style={{
                            padding: "10px 18px",
                            borderBottom: "1px solid #e5e5e5",
                            fontSize: 12,
                            color: "#dc2626",
                          }}
                        >
                          Compilation failed.
                        </div>
                      )}
                      {failedCount > 0 && (
                        <div
                          style={{ padding: "10px 18px", fontSize: 12, color: "rgba(0,0,0,0.7)" }}
                        >
                          {failedCount} check{failedCount === 1 ? "" : "s"} failed.
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Capture form — inline row */}
          {results.solved >= 3 && !submittedLead && (
            <div style={{ marginTop: 32 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError("");
                  }}
                  placeholder="Email"
                  maxLength={254}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    borderColor: emailError ? "#dc2626" : "#e5e5e5",
                  }}
                  onFocus={(e) => (e.target.style.borderColor = emailError ? "#dc2626" : "#fa5d19")}
                  onBlur={(e) => (e.target.style.borderColor = emailError ? "#dc2626" : "#e5e5e5")}
                />
                <input
                  value={github}
                  readOnly
                  style={{ ...inputStyle, flex: 1, color: "rgba(0,0,0,0.35)" }}
                />
                <input
                  value={xHandle}
                  onChange={(e) => {
                    setXHandle(e.target.value);
                    setXHandleError("");
                  }}
                  placeholder="@x_handle"
                  maxLength={16}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    borderColor: xHandleError ? "#dc2626" : "#e5e5e5",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = xHandleError ? "#dc2626" : "#fa5d19")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = xHandleError ? "#dc2626" : "#e5e5e5")
                  }
                />
                <input
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  placeholder="🔥{...}"
                  style={{ ...inputStyle, flex: 0.7 }}
                  onFocus={(e) => (e.target.style.borderColor = "#fa5d19")}
                  onBlur={(e) => (e.target.style.borderColor = "#e5e5e5")}
                />
                <button
                  disabled={!email.trim()}
                  onClick={submitLeadForm}
                  className="btn-heat"
                  style={{
                    height: 44,
                    padding: "0 24px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 800,
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  SUBMIT
                </button>
              </div>
              {(emailError || xHandleError) && (
                <p style={{ margin: "6px 0 0", fontSize: 12, color: "#dc2626", textAlign: "left" }}>
                  {emailError || xHandleError}
                </p>
              )}
            </div>
          )}

          {submittedLead && (
            <p style={{ marginTop: 28, fontSize: 15, fontWeight: 600, color: "#1a9338" }}>
              You&apos;re in. Share for the next challenge 🔥
            </p>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 12, marginTop: 36 }}>
            <button
              onClick={shareScore}
              className="btn-heat"
              style={{
                flex: 1,
                height: 46,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "inherit",
              }}
            >
              SHARE ON X
            </button>
            <button
              onClick={resetAll}
              className="btn-ghost"
              style={{
                flex: 1,
                height: 46,
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 800,
                fontFamily: "inherit",
              }}
            >
              TRY AGAIN
            </button>
          </div>

          {/* Continue to Level 2 after perfect Level 1 */}
          {currentLevel === 1 && results.solved >= PROBLEMS_PER_SESSION && (
            <button
              onClick={() => startGame(2)}
              className="btn-heat"
              style={{
                width: "100%",
                height: 52,
                borderRadius: 12,
                fontSize: 17,
                fontWeight: 800,
                letterSpacing: 2,
                fontFamily: "inherit",
                marginTop: 20,
                background: "#fa5d19",
              }}
            >
              CONTINUE TO LEVEL 2 →
            </button>
          )}

          {currentLevel === 2 &&
            (unlockedLevel >= 3 || results.solved >= PROBLEMS_PER_SESSION + LEVEL2_TOTAL) && (
              <button
                onClick={() => startGame(3)}
                className="btn-heat"
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 12,
                  fontSize: 17,
                  fontWeight: 800,
                  letterSpacing: 2,
                  fontFamily: "inherit",
                  marginTop: 20,
                  background: "#fa5d19",
                }}
              >
                CONTINUE TO LEVEL 3 →
              </button>
            )}
        </div>
      )}
    </div>
  );
}
