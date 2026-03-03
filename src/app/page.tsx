"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { LandingScreen } from "@/components/game/LandingScreen";
import { Level1Game } from "@/components/game/Level1Game";
import { Level2PrereqScreen } from "@/components/game/Level2PrereqScreen";
import { Level3PrereqScreen } from "@/components/game/Level3PrereqScreen";
import { MobileGateScreen } from "@/components/game/MobileGateScreen";
import { RestoreScreen } from "@/components/game/RestoreScreen";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { validateEmail, validateXHandle } from "@/lib/validation";
import { ROUND_DURATION_MS, ROUND_DURATION_SECONDS, PROBLEMS_PER_SESSION } from "@/lib/constants";
import {
  TOTAL_SOLVE_TARGET,
  type GameProblem,
  type Level2Problem,
  type Level3ChallengeState,
  type ResultsData,
  type RestoredSessionPayload,
  type Screen,
  type StoredFlowScreen,
  type StoredSessionSnapshot,
} from "@/lib/gameTypes";
import { isClientDevMode } from "@/lib/myEnv";
import { clientFetch } from "@/lib/client-identity";

type StoredResultsScreen = {
  screen: "results";
  currentLevel: number;
  results: ResultsData;
  email: string;
  xHandle: string;
  flag: string;
  submittedLead: boolean;
};

const MOBILE_BREAKPOINT = 900;
const Level2Game = dynamic(() => import("@/components/Level2Game").then((m) => m.Level2Game));
const Level3Game = dynamic(() => import("@/components/Level3Game").then((m) => m.Level3Game));
const ACTIVE_SESSION_STORAGE_KEY = "cheetcode.activeSession";
const SESSION_SNAPSHOT_STORAGE_KEY = "cheetcode.sessionSnapshot";
const FLOW_SCREEN_STORAGE_KEY = "cheetcode.flowScreen";
const RESULTS_SCREEN_STORAGE_KEY = "cheetcode.resultsScreen";
const LEVEL1_DRAFTS_STORAGE_KEY = "cheetcode.level1Drafts";
const LEVEL2_DRAFTS_STORAGE_KEY = "cheetcode.level2Drafts";
const LEVEL3_DRAFTS_STORAGE_KEY = "cheetcode.level3Drafts";
const LEVEL1_PASS_STORAGE_KEY = "cheetcode.level1Pass";
const DRAFT_PERSIST_DEBOUNCE_MS = 250;
const RESTORE_REQUEST_TIMEOUT_MS = 8_000;

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
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [didBootstrapSession, setDidBootstrapSession] = useState(false);
  const [needsRestoreVerification, setNeedsRestoreVerification] = useState(false);
  const [hasStoredActiveSession, setHasStoredActiveSession] = useState(false);
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
  const restoreAbortRef = useRef<AbortController | null>(null);
  const level1DraftsRef = useRef<Record<string, Record<string, string>> | null>(null);
  const level2DraftsRef = useRef<Record<string, Record<string, string>> | null>(null);
  const level3DraftsRef = useRef<Record<string, string> | null>(null);
  const level1PassRef = useRef<Record<string, Record<string, boolean | null>> | null>(null);
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
  const sessionSolveTarget = TOTAL_SOLVE_TARGET;

  // ── Level progression state ──
  const unlockedLevel = useQuery(api.leaderboard.getMyLevel, { github: github || "" }) ?? 1;
  const isLocalDev = isClientDevMode();
  const [currentLevel, setCurrentLevel] = useState(1);
  const [l2Problems, setL2Problems] = useState<Level2Problem[]>([]);
  const [l2Answers, setL2Answers] = useState<Record<string, string>>({});
  const [l3Challenge, setL3Challenge] = useState<Level3ChallengeState | null>(null);
  const [l3CodeDraft, setL3CodeDraft] = useState("");

  // No worker — local validation uses the same QuickJS sandbox as final scoring
  // via /api/validate-l1 to guarantee parity between local and server checks

  const getDraftCache = useCallback(
    <T,>(storageKey: string, ref: { current: T | null }, fallback: T): T => {
      if (ref.current) return ref.current;
      if (typeof window === "undefined") {
        ref.current = fallback;
        return fallback;
      }
      try {
        const raw = window.localStorage.getItem(storageKey);
        ref.current = raw ? (JSON.parse(raw) as T) : fallback;
      } catch {
        ref.current = fallback;
      }
      return ref.current;
    },
    [],
  );

  const persistActiveSession = useCallback(
    (nextSessionId: Id<"sessions">, level: number, nextExpiresAt: number) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          ACTIVE_SESSION_STORAGE_KEY,
          JSON.stringify({ sessionId: nextSessionId, level, expiresAt: nextExpiresAt }),
        );
      }
      setHasStoredActiveSession(true);
    },
    [],
  );

  const persistSessionSnapshot = useCallback((snapshot: StoredSessionSnapshot) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SESSION_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
  }, []);

  const persistFlowScreen = useCallback((nextScreen: StoredFlowScreen["screen"], level: 2 | 3) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      FLOW_SCREEN_STORAGE_KEY,
      JSON.stringify({ screen: nextScreen, pendingLevel: level } satisfies StoredFlowScreen),
    );
  }, []);

  const clearStoredFlowScreen = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(FLOW_SCREEN_STORAGE_KEY);
  }, []);

  const persistResultsScreen = useCallback((snapshot: StoredResultsScreen) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(RESULTS_SCREEN_STORAGE_KEY, JSON.stringify(snapshot));
  }, []);

  const clearStoredResults = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(RESULTS_SCREEN_STORAGE_KEY);
  }, []);

  const clearStoredSession = useCallback(() => {
    restoreAbortRef.current?.abort();
    restoreAbortRef.current = null;
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(SESSION_SNAPSHOT_STORAGE_KEY);
    }
    setHasStoredActiveSession(false);
    setNeedsRestoreVerification(false);
    setIsRestoringSession(false);
  }, []);

  const clearFlowState = useCallback(() => {
    clearStoredFlowScreen();
    clearStoredResults();
    setPendingLevel(null);
    setLevel3Preview(null);
    setLevel3PreviewError(null);
    setSubmittedLead(false);
    setResults(null);
    setIsSubmitting(false);
    lockedTimeElapsedMsRef.current = null;
  }, [clearStoredFlowScreen, clearStoredResults]);

  const applySessionPayload = useCallback(
    (payload: RestoredSessionPayload) => {
      setCurrentLevel(payload.level);
      setSessionId(payload.sessionId);
      setExpiresAt(payload.expiresAt);

      if (payload.level === 2) {
        setL2Problems(payload.problems as Level2Problem[]);
        setProblems([]);
        setL3Challenge(null);
        const drafts = getDraftCache(
          LEVEL2_DRAFTS_STORAGE_KEY,
          level2DraftsRef,
          {} as Record<string, Record<string, string>>,
        );
        setL2Answers(drafts[payload.sessionId] ?? {});
        setCodes({});
        setL3CodeDraft("");
        setLocalPass({});
        return;
      }

      if (payload.level === 3) {
        const challenge = payload.problems[0] as Level3ChallengeState;
        setL3Challenge(challenge);
        setProblems([]);
        setL2Problems([]);
        setL2Answers({});
        setCodes({});
        const drafts = getDraftCache(
          LEVEL3_DRAFTS_STORAGE_KEY,
          level3DraftsRef,
          {} as Record<string, string>,
        );
        setL3CodeDraft(drafts[payload.sessionId] ?? challenge.starterCode);
        setLocalPass({});
        return;
      }

      const level1Problems = payload.problems as GameProblem[];
      setProblems(level1Problems);
      setL2Problems([]);
      setL3Challenge(null);
      setL2Answers({});
      setL3CodeDraft("");
      const drafts = getDraftCache(
        LEVEL1_DRAFTS_STORAGE_KEY,
        level1DraftsRef,
        {} as Record<string, Record<string, string>>,
      );
      setCodes(
        Object.fromEntries(
          level1Problems.map((p) => [p.id, drafts[payload.sessionId]?.[p.id] ?? p.starterCode]),
        ),
      );
      const passState = getDraftCache(
        LEVEL1_PASS_STORAGE_KEY,
        level1PassRef,
        {} as Record<string, Record<string, boolean | null>>,
      );
      setLocalPass(passState[payload.sessionId] ?? {});
    },
    [getDraftCache],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!raw) {
        setHasStoredActiveSession(false);
        const flowRaw = window.localStorage.getItem(FLOW_SCREEN_STORAGE_KEY);
        if (flowRaw) {
          const flow = JSON.parse(flowRaw) as Partial<StoredFlowScreen>;
          if (
            (flow.screen === "level2-prereq" || flow.screen === "level3-prereq") &&
            (flow.pendingLevel === 2 || flow.pendingLevel === 3)
          ) {
            setPendingLevel(flow.pendingLevel);
            setScreen(flow.screen);
            setDidBootstrapSession(true);
            return;
          } else {
            clearStoredFlowScreen();
          }
        }
        const resultsRaw = window.localStorage.getItem(RESULTS_SCREEN_STORAGE_KEY);
        if (resultsRaw) {
          const storedResults = JSON.parse(resultsRaw) as Partial<StoredResultsScreen>;
          if (storedResults.screen === "results" && storedResults.results) {
            setCurrentLevel(
              typeof storedResults.currentLevel === "number" ? storedResults.currentLevel : 1,
            );
            setResults(storedResults.results);
            setEmail(storedResults.email ?? "");
            setXHandle(storedResults.xHandle ?? "");
            setFlag(storedResults.flag ?? "");
            setSubmittedLead(storedResults.submittedLead === true);
            setScreen("results");
          } else {
            clearStoredResults();
          }
        }
        setDidBootstrapSession(true);
        return;
      }
      const persisted = JSON.parse(raw) as {
        sessionId?: string;
        level?: number;
        expiresAt?: number;
      };
      const hasActive = !!persisted.sessionId && Number(persisted.expiresAt) > Date.now();
      setHasStoredActiveSession(hasActive);
      if (!hasActive) {
        clearStoredSession();
        setDidBootstrapSession(true);
        return;
      }

      const snapshotRaw = window.localStorage.getItem(SESSION_SNAPSHOT_STORAGE_KEY);
      if (!snapshotRaw) {
        setNeedsRestoreVerification(true);
        setDidBootstrapSession(true);
        return;
      }
      const snapshot = JSON.parse(snapshotRaw) as StoredSessionSnapshot;
      if (
        snapshot.sessionId !== persisted.sessionId ||
        snapshot.level !== persisted.level ||
        snapshot.expiresAt <= Date.now()
      ) {
        setNeedsRestoreVerification(true);
        setDidBootstrapSession(true);
        return;
      }

      applySessionPayload(snapshot);
      clearFlowState();
      setScreen("playing");
      setNeedsRestoreVerification(true);
      setDidBootstrapSession(true);
    } catch {
      clearStoredSession();
      setDidBootstrapSession(true);
    }
  }, [
    applySessionPayload,
    clearFlowState,
    clearStoredFlowScreen,
    clearStoredResults,
    clearStoredSession,
  ]);

  useEffect(() => {
    if (authStatus !== "unauthenticated") return;
    clearStoredFlowScreen();
    clearStoredResults();
    clearStoredSession();
    setIsRestoringSession(false);
  }, [authStatus, clearStoredFlowScreen, clearStoredResults, clearStoredSession]);

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
      clearStoredSession();
      setResults(d);
      setScreen("results");
    } catch (err) {
      console.error("submitResults failed:", err);
      setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    sessionId,
    results,
    isSubmitting,
    github,
    timeLeftMs,
    problems,
    codes,
    flag,
    clearStoredSession,
  ]);

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
      const payload = {
        sessionId: d.sessionId as Id<"sessions">,
        level: d.level,
        expiresAt: d.expiresAt,
        problems: d.problems as unknown[],
      };
      applySessionPayload(payload);
      clearFlowState();
      persistActiveSession(payload.sessionId, payload.level, payload.expiresAt);
      persistSessionSnapshot(payload);
      setNeedsRestoreVerification(false);
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
    clearStoredResults();
    if (level === 2) {
      setPendingLevel(2);
      persistFlowScreen("level2-prereq", 2);
      setScreen("level2-prereq");
      return;
    }
    if (level === 3) {
      setPendingLevel(3);
      setLevel3Preview(null);
      setLevel3PreviewError(null);
      persistFlowScreen("level3-prereq", 3);
      setScreen("level3-prereq");
      return;
    }
    await launchLevel(level);
  }

  useEffect(() => {
    if (!didBootstrapSession || !isAuthenticated || !needsRestoreVerification || isRestoringSession)
      return;
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return;

    let persisted: { sessionId: string; level: number; expiresAt: number } | null = null;
    try {
      persisted = JSON.parse(raw) as { sessionId: string; level: number; expiresAt: number };
    } catch {
      clearStoredSession();
      return;
    }
    if (!persisted?.sessionId || persisted.expiresAt <= Date.now()) {
      clearStoredSession();
      return;
    }

    let cancelled = false;
    function abortRestoreRequest() {
      const controller = restoreAbortRef.current;
      if (!controller) return;
      restoreAbortRef.current = null;
      if (controller.signal.aborted) return;
      try {
        controller.abort();
      } catch {
        // Ignore cleanup abort failures from the fetch implementation.
      }
    }

    async function restoreSession() {
      setIsRestoringSession(true);
      const controller = new AbortController();
      restoreAbortRef.current = controller;
      const timeoutId = window.setTimeout(() => controller.abort(), RESTORE_REQUEST_TIMEOUT_MS);
      try {
        const res = await clientFetch("/api/session/restore", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: persisted?.sessionId }),
          signal: controller.signal,
        });
        if (!res.ok) {
          clearStoredSession();
          if (!cancelled) setScreen("landing");
          return;
        }
        const d = await res.json();
        if (cancelled) return;
        const payload = {
          sessionId: d.sessionId as Id<"sessions">,
          level: d.level,
          expiresAt: d.expiresAt,
          problems: d.problems as unknown[],
        };
        applySessionPayload(payload);
        clearFlowState();
        persistActiveSession(payload.sessionId, payload.level, payload.expiresAt);
        persistSessionSnapshot(payload);
        setNeedsRestoreVerification(false);
        setScreen("playing");
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("restore failed:", err);
        clearStoredSession();
        if (!cancelled) setScreen("landing");
      } finally {
        window.clearTimeout(timeoutId);
        if (restoreAbortRef.current === controller) {
          restoreAbortRef.current = null;
        }
        if (!cancelled) setIsRestoringSession(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
      abortRestoreRequest();
    };
  }, [
    applySessionPayload,
    clearFlowState,
    clearStoredSession,
    didBootstrapSession,
    isAuthenticated,
    isRestoringSession,
    needsRestoreVerification,
    persistActiveSession,
    persistSessionSnapshot,
  ]);

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
    clearStoredSession();
    clearStoredResults();
    level1DraftsRef.current = null;
    level2DraftsRef.current = null;
    level3DraftsRef.current = null;
    level1PassRef.current = null;
    setScreen("landing");
    setPendingLevel(null);
    setLevel3Preview(null);
    setLevel3PreviewError(null);
    setSessionId(null);
    setExpiresAt(0);
    setProblems([]);
    setL2Problems([]);
    setL3Challenge(null);
    setL2Answers({});
    setL3CodeDraft("");
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

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 1 || !sessionId || screen !== "playing")
      return;
    const drafts = getDraftCache(
      LEVEL1_DRAFTS_STORAGE_KEY,
      level1DraftsRef,
      {} as Record<string, Record<string, string>>,
    );
    drafts[sessionId] = codes;
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(LEVEL1_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [codes, currentLevel, getDraftCache, sessionId, screen]);

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 1 || !sessionId || screen !== "playing")
      return;
    const passState = getDraftCache(
      LEVEL1_PASS_STORAGE_KEY,
      level1PassRef,
      {} as Record<string, Record<string, boolean | null>>,
    );
    passState[sessionId] = localPass;
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(LEVEL1_PASS_STORAGE_KEY, JSON.stringify(passState));
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [currentLevel, getDraftCache, localPass, sessionId, screen]);

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 2 || !sessionId || screen !== "playing")
      return;
    const drafts = getDraftCache(
      LEVEL2_DRAFTS_STORAGE_KEY,
      level2DraftsRef,
      {} as Record<string, Record<string, string>>,
    );
    drafts[sessionId] = l2Answers;
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(LEVEL2_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [currentLevel, getDraftCache, l2Answers, sessionId, screen]);

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 3 || !sessionId || screen !== "playing")
      return;
    const drafts = getDraftCache(
      LEVEL3_DRAFTS_STORAGE_KEY,
      level3DraftsRef,
      {} as Record<string, string>,
    );
    drafts[sessionId] = l3CodeDraft;
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(LEVEL3_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [currentLevel, getDraftCache, l3CodeDraft, sessionId, screen]);

  useEffect(() => {
    if (typeof window === "undefined" || !sessionId || screen !== "playing") return;
    const problemsSnapshot =
      currentLevel === 1
        ? problems
        : currentLevel === 2
          ? l2Problems
          : l3Challenge
            ? [l3Challenge]
            : [];
    if (problemsSnapshot.length === 0) return;
    persistSessionSnapshot({
      sessionId,
      level: currentLevel,
      expiresAt,
      problems: problemsSnapshot,
    });
  }, [
    currentLevel,
    expiresAt,
    l2Problems,
    l3Challenge,
    persistSessionSnapshot,
    problems,
    screen,
    sessionId,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || screen !== "results" || !results) return;
    persistResultsScreen({
      screen: "results",
      currentLevel,
      results,
      email,
      xHandle,
      flag,
      submittedLead,
    });
  }, [currentLevel, email, flag, persistResultsScreen, results, screen, submittedLead, xHandle]);

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
      <MobileGateScreen
        leaderboard={leaderboard}
        totalSolveTarget={TOTAL_SOLVE_TARGET}
        displayedSolveTarget={displayedSolveTarget}
      />
    );
  }

  if (
    !didBootstrapSession ||
    (hasStoredActiveSession && isRestoringSession && screen === "landing")
  ) {
    return <RestoreScreen />;
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
          initialAnswers={l2Answers}
          onAnswersChange={setL2Answers}
          onFinishAction={(results) => {
            clearStoredSession();
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
          initialCode={l3CodeDraft}
          onCodeChange={setL3CodeDraft}
          onFinishAction={(results) => {
            clearStoredSession();
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
    return (
      <Level2PrereqScreen
        pendingLevel={pendingLevel}
        onCopy={copyToClipboard}
        onStart={launchLevel}
        onBack={() => {
          clearStoredFlowScreen();
          setPendingLevel(null);
          setScreen("landing");
        }}
      />
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
      <Level3PrereqScreen
        pendingLevel={pendingLevel}
        level3Preview={level3Preview}
        level3PreviewLoading={level3PreviewLoading}
        level3PreviewError={level3PreviewError}
        compilerCommand={level3CompilerCommand}
        onCopy={copyToClipboard}
        onStart={launchLevel}
        onBack={() => {
          clearStoredFlowScreen();
          setPendingLevel(null);
          setScreen("landing");
        }}
      />
    );
  }

  /* ═══════════════════════════════════════════════════════════
     RESULTS
     ═══════════════════════════════════════════════════════════ */
  if (results) {
    return (
      <ResultsScreen
        results={results}
        displayedSolveTarget={sessionSolveTarget}
        currentLevel={currentLevel}
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
