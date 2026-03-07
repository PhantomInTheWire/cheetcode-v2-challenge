"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useRoundCountdown } from "@/hooks/useRoundCountdown";
import { isClientDevMode } from "@/lib/config/env";
import { clientFetch } from "@/lib/fingerprint/client-identity";
import {
  inferProjectFromProblemId,
  Level2GameView,
  type Level2Problem,
  type Level2ProjectKey,
} from "@/components/game/Level2GameView";

const ROUND_DURATION_L2_MS = 60_000;
const LEVEL2_STATUS_STORAGE_KEY = "cheetcode.level2Status";

type Level2GameProps = {
  sessionId: Id<"sessions">;
  github: string;
  problems: Level2Problem[];
  expiresAt: number;
  scoreSnapshot?: { elo: number; solved: number; rank: number } | null;
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
  scoreSnapshot,
  initialAnswers,
  onAnswersChangeAction,
  onFinishAction,
}: Level2GameProps) {
  const canAutoSolve = isClientDevMode();
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers ?? {});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localCorrect, setLocalCorrect] = useState<Record<string, boolean | null>>({});
  const lockedTimeElapsedMsRef = useRef<number | null>(null);
  const autoSubmittedRef = useRef(false);
  const initialAnswersRef = useRef(initialAnswers ?? {});

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

  const { timeLeftMs, timeUp } = useRoundCountdown(expiresAt);
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

  const finishGame = useCallback(async () => {
    if (!sessionId || isSubmitting) return;
    if (lockedTimeElapsedMsRef.current === null) {
      lockedTimeElapsedMsRef.current = ROUND_DURATION_L2_MS - timeLeftMs;
    }
    const lockedTimeElapsedMs = lockedTimeElapsedMsRef.current;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const finishRes = await clientFetch("/api/level-2/finish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          github,
          timeElapsed: lockedTimeElapsedMs,
          answers,
          runScoreSnapshot: scoreSnapshot,
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
  }, [sessionId, github, answers, timeLeftMs, isSubmitting, onFinishAction, scoreSnapshot]);

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
      const res = await clientFetch("/api/level-2/validate", {
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

  return (
    <Level2GameView
      github={github}
      canAutoSolve={canAutoSolve}
      isSubmitting={isSubmitting}
      timeUp={timeUp}
      submitError={submitError}
      solvedLocal={solvedLocal}
      problems={problems}
      answers={answers}
      localCorrect={localCorrect}
      sessionProjects={sessionProjects}
      onAutoSolve={() => void autoSolve()}
      onFinishGame={() => void finishGame()}
      onAnswerChange={(problemId, value) =>
        setAnswers((current) => ({ ...current, [problemId]: value }))
      }
      onCheckAnswer={(problemId) => {
        void checkAnswer(problemId);
      }}
      onDismissSubmitError={() => setSubmitError(null)}
    />
  );
}
