import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
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
import { clientFetch } from "@/lib/client-identity";

type LeaderboardRow = { solved: number };

type StoredResultsScreen = {
  screen: "results" | "level3-verification";
  github: string;
  currentLevel: number;
  sessionId: Id<"sessions"> | null;
  results: ResultsData;
  submittedLead: boolean;
};

type UseHomeGameStateArgs = {
  github: string;
  authStatus: "loading" | "authenticated" | "unauthenticated";
  isAuthenticated: boolean;
  leaderboard: LeaderboardRow[];
  unlockedLevel: number;
  isLocalDev: boolean;
  canAutoSolve: boolean;
};

type LegacySessionStorageRef<T> = { current: Record<string, T> | null };

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
const ORIGINAL_TWEET_URL = "https://x.com/CalebPeffer/status/2024167056372097131";

function sessionScopedStorageKey(baseKey: string, sessionId: string) {
  return `${baseKey}:${sessionId}`;
}

export function useHomeGameState({
  github,
  authStatus,
  isAuthenticated,
  leaderboard,
  unlockedLevel,
  isLocalDev,
  canAutoSolve,
}: UseHomeGameStateArgs) {
  const [screen, setScreen] = useState<Screen>("landing");
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const [level2Preview, setLevel2Preview] = useState<Array<{
    key: string;
    label: string;
    commit: string;
  }> | null>(null);
  const [level2PreviewLoading, setLevel2PreviewLoading] = useState(false);
  const [level2PreviewError, setLevel2PreviewError] = useState<string | null>(null);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState("");
  const [xHandleError, setXHandleError] = useState("");
  const [currentLevel, setCurrentLevel] = useState(1);
  const [l2Problems, setL2Problems] = useState<Level2Problem[]>([]);
  const [l2Answers, setL2Answers] = useState<Record<string, string>>({});
  const [l3Challenge, setL3Challenge] = useState<Level3ChallengeState | null>(null);
  const [l3CodeDraft, setL3CodeDraft] = useState("");

  const lockedTimeElapsedMsRef = useRef<number | null>(null);
  const restoreAbortRef = useRef<AbortController | null>(null);
  const level1DraftsRef = useRef<Record<string, Record<string, string>> | null>(null);
  const level2DraftsRef = useRef<Record<string, Record<string, string>> | null>(null);
  const level3DraftsRef = useRef<Record<string, string> | null>(null);
  const level1PassRef = useRef<Record<string, Record<string, boolean | null>> | null>(null);

  const displayedSolveTarget = useMemo(() => {
    const bestFromBoard = leaderboard.reduce(
      (max, row) => Math.max(max, row.solved),
      TOTAL_SOLVE_TARGET,
    );
    const bestFromSession = results ? Math.max(bestFromBoard, results.solved) : bestFromBoard;
    return Math.max(TOTAL_SOLVE_TARGET, bestFromSession);
  }, [leaderboard, results]);
  const sessionSolveTarget = TOTAL_SOLVE_TARGET;

  const getDraftCache = useCallback(
    <T>(storageKey: string, ref: { current: T | null }, fallback: T): T => {
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

  const readSessionScopedValue = useCallback(
    <T>(
      storageKey: string,
      activeSessionId: string,
      fallback: T,
      legacyRef?: LegacySessionStorageRef<T>,
    ): T => {
      if (typeof window === "undefined") return fallback;
      try {
        const raw = window.localStorage.getItem(
          sessionScopedStorageKey(storageKey, activeSessionId),
        );
        if (raw) return JSON.parse(raw) as T;
      } catch {
        // Fall back to the legacy aggregate cache below.
      }
      if (!legacyRef) return fallback;
      const legacyCache = getDraftCache(storageKey, legacyRef, {} as Record<string, T>);
      return legacyCache[activeSessionId] ?? fallback;
    },
    [getDraftCache],
  );

  const writeSessionScopedValue = useCallback(
    <T>(storageKey: string, activeSessionId: string, value: T) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        sessionScopedStorageKey(storageKey, activeSessionId),
        JSON.stringify(value),
      );
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

  const updateActiveSessionExpiry = useCallback(
    (nextExpiresAt: number) => {
      if (!sessionId || currentLevel !== 3 || !Number.isFinite(nextExpiresAt)) return;
      setExpiresAt(nextExpiresAt);
      persistActiveSession(sessionId, currentLevel, nextExpiresAt);
      if (l3Challenge) {
        persistSessionSnapshot({
          sessionId,
          level: currentLevel,
          expiresAt: nextExpiresAt,
          problems: [l3Challenge],
        });
      }
    },
    [currentLevel, l3Challenge, persistActiveSession, persistSessionSnapshot, sessionId],
  );

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

  const abortRestoreRequest = useCallback(() => {
    const controller = restoreAbortRef.current;
    if (!controller) return;
    restoreAbortRef.current = null;
    if (controller.signal.aborted) return;
    try {
      controller.abort();
    } catch {
      // Ignore cleanup abort failures from the fetch implementation.
    }
  }, []);

  const clearStoredSession = useCallback(() => {
    abortRestoreRequest();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      window.localStorage.removeItem(SESSION_SNAPSHOT_STORAGE_KEY);
    }
    setHasStoredActiveSession(false);
    setNeedsRestoreVerification(false);
    setIsRestoringSession(false);
  }, [abortRestoreRequest]);

  const clearFlowState = useCallback(() => {
    clearStoredFlowScreen();
    clearStoredResults();
    setPendingLevel(null);
    setLevel2Preview(null);
    setLevel2PreviewLoading(false);
    setLevel2PreviewError(null);
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
        const drafts = readSessionScopedValue(
          LEVEL2_DRAFTS_STORAGE_KEY,
          payload.sessionId,
          {} as Record<string, string>,
          level2DraftsRef,
        );
        setL2Answers(drafts);
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
        const drafts = readSessionScopedValue(
          LEVEL3_DRAFTS_STORAGE_KEY,
          payload.sessionId,
          challenge.starterCode,
          level3DraftsRef,
        );
        setL3CodeDraft(drafts);
        setLocalPass({});
        return;
      }

      const level1Problems = payload.problems as GameProblem[];
      setProblems(level1Problems);
      setL2Problems([]);
      setL3Challenge(null);
      setL2Answers({});
      setL3CodeDraft("");
      const drafts = readSessionScopedValue(
        LEVEL1_DRAFTS_STORAGE_KEY,
        payload.sessionId,
        {} as Record<string, string>,
        level1DraftsRef,
      );
      setCodes(
        Object.fromEntries(level1Problems.map((p) => [p.id, drafts[p.id] ?? p.starterCode])),
      );
      const passState = readSessionScopedValue(
        LEVEL1_PASS_STORAGE_KEY,
        payload.sessionId,
        {} as Record<string, boolean | null>,
        level1PassRef,
      );
      setLocalPass(passState);
    },
    [readSessionScopedValue],
  );

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
          }
          clearStoredFlowScreen();
        }

        const resultsRaw = window.localStorage.getItem(RESULTS_SCREEN_STORAGE_KEY);
        if (resultsRaw) {
          const storedResults = JSON.parse(resultsRaw) as Partial<StoredResultsScreen>;
          if (
            (storedResults.screen === "results" ||
              storedResults.screen === "level3-verification") &&
            storedResults.results &&
            storedResults.github === github
          ) {
            setCurrentLevel(
              typeof storedResults.currentLevel === "number" ? storedResults.currentLevel : 1,
            );
            setSessionId(storedResults.sessionId ?? null);
            setResults(storedResults.results);
            setEmail("");
            setXHandle("");
            setFlag("");
            setSubmittedLead(storedResults.submittedLead === true);
            setScreen(storedResults.screen);
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
    github,
  ]);

  useEffect(() => {
    if (authStatus !== "unauthenticated") return;
    clearStoredFlowScreen();
    clearStoredResults();
    clearStoredSession();
    setIsRestoringSession(false);
  }, [authStatus, clearStoredFlowScreen, clearStoredResults, clearStoredSession]);

  const solvedLocal = useMemo(
    () => problems.filter((p) => localPass[p.id] === true).length,
    [problems, localPass],
  );

  const finishGame = useCallback(async () => {
    if (!sessionId || results || isSubmitting) return;
    if (lockedTimeElapsedMsRef.current === null) {
      const remainingMs = Math.max(0, expiresAt - Date.now());
      lockedTimeElapsedMsRef.current = ROUND_DURATION_MS - remainingMs;
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
      const data = await res.json();
      clearStoredSession();
      setResults(data);
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
    expiresAt,
    github,
    problems,
    codes,
    flag,
    clearStoredSession,
  ]);

  useEffect(() => {
    if (screen !== "playing" || currentLevel !== 1 || !sessionId || expiresAt <= 0) return;
    const timeoutMs = Math.max(0, expiresAt - Date.now());
    const timeoutId = window.setTimeout(() => {
      void finishGame();
    }, timeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [currentLevel, expiresAt, finishGame, screen, sessionId]);

  const launchLevel = useCallback(
    async (level: number, level3ChallengeId?: string, level2Projects?: string[]) => {
      if (!isAuthenticated) return;
      if (!isLocalDev && level > unlockedLevel) return;

      setSubmitError(null);
      try {
        const res = await clientFetch("/api/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ level, isDev: isLocalDev, level3ChallengeId, level2Projects }),
        });
        if (!res.ok) throw new Error(`session creation failed: ${res.status}`);
        const data = await res.json();
        const payload = {
          sessionId: data.sessionId as Id<"sessions">,
          level: data.level,
          expiresAt: data.expiresAt,
          problems: data.problems as unknown[],
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
    },
    [
      applySessionPayload,
      clearFlowState,
      isAuthenticated,
      isLocalDev,
      persistActiveSession,
      persistSessionSnapshot,
      unlockedLevel,
    ],
  );

  const startGame = useCallback(
    async (requestedLevel?: number) => {
      const level = requestedLevel ?? 1;
      clearStoredResults();
      if (level === 2) {
        setPendingLevel(2);
        setLevel2Preview(null);
        setLevel2PreviewError(null);
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
    },
    [clearStoredResults, launchLevel, persistFlowScreen],
  );

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
        const data = await res.json();
        if (cancelled) return;
        const payload = {
          sessionId: data.sessionId as Id<"sessions">,
          level: data.level,
          expiresAt: data.expiresAt,
          problems: data.problems as unknown[],
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
    abortRestoreRequest,
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
    if (screen !== "level2-prereq") return;
    let cancelled = false;

    async function loadLevel2Preview() {
      setLevel2PreviewLoading(true);
      setLevel2PreviewError(null);
      try {
        const res = await clientFetch("/api/level2-preview", { method: "GET" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Failed to load Level 2 preview");
        }
        if (cancelled) return;
        setLevel2Preview(Array.isArray(data.projects) ? data.projects : null);
      } catch (err) {
        if (cancelled) return;
        setLevel2PreviewError(
          err instanceof Error ? err.message : "Failed to load Level 2 preview",
        );
      } finally {
        if (!cancelled) setLevel2PreviewLoading(false);
      }
    }

    void loadLevel2Preview();
    return () => {
      cancelled = true;
    };
  }, [screen]);

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

  const runLocalCheck = useCallback(
    async (problem: GameProblem) => {
      setLocalPass((cur) => ({ ...cur, [problem.id]: null }));
      try {
        const res = await clientFetch("/api/validate-l1", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId,
            problemId: problem.id,
            code: codes[problem.id] ?? problem.starterCode,
          }),
        });
        const data = await res.json();
        setLocalPass((cur) => ({ ...cur, [problem.id]: data.passed === true }));
      } catch {
        setLocalPass((cur) => ({ ...cur, [problem.id]: false }));
      }
    },
    [codes, sessionId],
  );

  const submitLeadForm = useCallback(async () => {
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
  }, [email, flag, sessionId, xHandle]);

  const resetAll = useCallback(() => {
    clearStoredSession();
    clearStoredResults();
    level1DraftsRef.current = null;
    level2DraftsRef.current = null;
    level3DraftsRef.current = null;
    level1PassRef.current = null;
    setScreen("landing");
    setPendingLevel(null);
    setLevel2Preview(null);
    setLevel2PreviewLoading(false);
    setLevel2PreviewError(null);
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
  }, [clearStoredResults, clearStoredSession]);

  const shareScore = useCallback(async () => {
    if (!results) return;
    const text = `I just scored ${results.elo.toLocaleString()} (rank #${results.rank}) on CheetCode CTF — ${PROBLEMS_PER_SESSION} problems, ${ROUND_DURATION_SECONDS} seconds. Think your agent can beat it? 🔥`;
    const fullText = `${text}\n\n${ORIGINAL_TWEET_URL}`;
    const tweetUrl = `https://x.com/intent/post?text=${encodeURIComponent(fullText)}`;
    window.open(tweetUrl, "_blank", "noopener,noreferrer");
    try {
      await navigator.clipboard.writeText(fullText);
    } catch (err) {
      console.error("copy share text failed:", err);
    }
  }, [results]);

  const autoSolve = useCallback(async () => {
    if (!sessionId || !canAutoSolve) return;
    setIsAutoSolving(true);
    try {
      const res = await clientFetch("/api/dev/auto-solve-l1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problemIds: problems.map((p) => p.id) }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { solutions: Record<string, string> };
      setCodes((cur) => ({ ...cur, ...data.solutions }));

      const solvedIds = problems
        .map((p) => p.id)
        .filter((id) => Boolean(data.solutions[id]?.trim()));
      if (solvedIds.length > 0) {
        setLocalPass((cur) => {
          const next = { ...cur };
          for (const id of solvedIds) next[id] = null;
          return next;
        });
      }

      const items = problems
        .map((p) => ({ problemId: p.id, code: data.solutions[p.id] ?? "", testCases: p.testCases }))
        .filter((item) => item.code.trim().length > 0);

      if (items.length > 0) {
        const validationRes = await clientFetch("/api/validate-batch", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, items }),
        });

        if (validationRes.ok) {
          const validationData = (await validationRes.json()) as {
            results: Record<string, { passed: boolean; error?: string }>;
          };
          setLocalPass((cur) => {
            const next = { ...cur };
            for (const problem of problems) {
              const result = validationData.results?.[problem.id];
              if (result) {
                next[problem.id] = result.passed === true;
              } else if (data.solutions[problem.id]?.trim()) {
                next[problem.id] = null;
              }
            }
            return next;
          });
        } else {
          const outcomes = await Promise.all(
            problems.map(async (problem) => {
              const code = data.solutions[problem.id];
              if (!code?.trim()) return [problem.id, null] as const;
              try {
                const single = await clientFetch("/api/validate-l1", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ sessionId, problemId: problem.id, code }),
                });
                if (!single.ok) return [problem.id, null] as const;
                const singleData = await single.json();
                return [problem.id, singleData.passed === true] as const;
              } catch {
                return [problem.id, null] as const;
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
  }, [canAutoSolve, problems, sessionId]);

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 1 || !sessionId || screen !== "playing")
      return;
    const timeoutId = window.setTimeout(() => {
      writeSessionScopedValue(LEVEL1_DRAFTS_STORAGE_KEY, sessionId, codes);
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [codes, currentLevel, sessionId, screen, writeSessionScopedValue]);

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 1 || !sessionId || screen !== "playing")
      return;
    const timeoutId = window.setTimeout(() => {
      writeSessionScopedValue(LEVEL1_PASS_STORAGE_KEY, sessionId, localPass);
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [currentLevel, localPass, sessionId, screen, writeSessionScopedValue]);

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 2 || !sessionId || screen !== "playing")
      return;
    const timeoutId = window.setTimeout(() => {
      writeSessionScopedValue(LEVEL2_DRAFTS_STORAGE_KEY, sessionId, l2Answers);
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [currentLevel, l2Answers, sessionId, screen, writeSessionScopedValue]);

  useEffect(() => {
    if (typeof window === "undefined" || currentLevel !== 3 || !sessionId || screen !== "playing")
      return;
    const timeoutId = window.setTimeout(() => {
      writeSessionScopedValue(LEVEL3_DRAFTS_STORAGE_KEY, sessionId, l3CodeDraft);
    }, DRAFT_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [currentLevel, l3CodeDraft, sessionId, screen, writeSessionScopedValue]);

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
    if (
      typeof window === "undefined" ||
      (screen !== "results" && screen !== "level3-verification") ||
      !results
    )
      return;
    persistResultsScreen({
      screen,
      github,
      currentLevel,
      sessionId,
      results,
      submittedLead,
    });
  }, [currentLevel, github, persistResultsScreen, results, screen, sessionId, submittedLead]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("copy failed:", err);
    }
  }, []);

  return {
    screen,
    setScreen,
    pendingLevel,
    setPendingLevel,
    level2Preview,
    level2PreviewLoading,
    level2PreviewError,
    level3Preview,
    setLevel3Preview,
    level3PreviewLoading,
    level3PreviewError,
    setLevel3PreviewError,
    isRestoringSession,
    didBootstrapSession,
    hasStoredActiveSession,
    sessionId,
    expiresAt,
    updateActiveSessionExpiry,
    problems,
    codes,
    setCodes,
    localPass,
    results,
    setResults,
    email,
    setEmail,
    xHandle,
    setXHandle,
    flag,
    setFlag,
    submittedLead,
    isAutoSolving,
    isSubmitting,
    submitError,
    setSubmitError,
    emailError,
    setEmailError,
    xHandleError,
    setXHandleError,
    displayedSolveTarget,
    sessionSolveTarget,
    currentLevel,
    l2Problems,
    l2Answers,
    setL2Answers,
    l3Challenge,
    l3CodeDraft,
    setL3CodeDraft,
    solvedLocal,
    finishGame,
    startGame,
    launchLevel,
    runLocalCheck,
    submitLeadForm,
    resetAll,
    shareScore,
    autoSolve,
    clearStoredSession,
    clearStoredFlowScreen,
    copyToClipboard,
    canAutoSolve,
  };
}
