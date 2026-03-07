"use client";

import { useEffect, useEffectEvent, useMemo, useRef } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import type {
  GameProblem,
  Level2Problem,
  Level3ChallengeState,
  ResultsData,
  Screen,
} from "@/lib/gameTypes";
import { postSessionReplayEvent } from "@/lib/session-replay-client";
import type { SessionReplayEventType } from "@/lib/session-replay-contract";

const SNAPSHOT_DEBOUNCE_MS = 1_200;
const HEARTBEAT_INTERVAL_MS = 5_000;

type UseSessionReplayArgs = {
  github: string;
  isAuthenticated: boolean;
  sessionId: Id<"sessions"> | null;
  currentLevel: number;
  screen: Screen;
  expiresAt: number;
  problems: GameProblem[];
  codes: Record<string, string>;
  localPass: Record<string, boolean | null>;
  l2Problems: Level2Problem[];
  l2Answers: Record<string, string>;
  l3Challenge: Level3ChallengeState | null;
  l3CodeDraft: string;
  results: ResultsData | null;
  isSubmitting: boolean;
  isRestoringSession: boolean;
  submitError: string | null;
  submittedLead: boolean;
};

function summarizeLevel1Problems(problems: GameProblem[]) {
  return problems.map((problem) => ({
    id: problem.id,
    title: problem.title,
    tier: problem.tier,
  }));
}

function summarizeLevel2Problems(problems: Level2Problem[]) {
  return problems.map((problem) => ({
    id: problem.id,
    project: problem.project,
    question: problem.question,
  }));
}

function summarizeLevel3Challenge(challenge: Level3ChallengeState) {
  return {
    id: challenge.id,
    title: challenge.title,
    taskName: challenge.taskName,
    language: challenge.language,
    checks: challenge.checks.map((check) => ({
      id: check.id,
      name: check.name,
    })),
  };
}

export function useSessionReplay({
  github,
  isAuthenticated,
  sessionId,
  currentLevel,
  screen,
  expiresAt,
  problems,
  codes,
  localPass,
  l2Problems,
  l2Answers,
  l3Challenge,
  l3CodeDraft,
  results,
  isSubmitting,
  isRestoringSession,
  submitError,
  submittedLead,
}: UseSessionReplayArgs) {
  const lastScreenKeyRef = useRef<string | null>(null);
  const lastSnapshotJsonRef = useRef<string | null>(null);
  const lastResultsKeyRef = useRef<string | null>(null);

  const summary = useMemo(() => {
    const totalProblems =
      currentLevel === 1
        ? problems.length
        : currentLevel === 2
          ? l2Problems.length
          : (l3Challenge?.checks.length ?? 0);
    const draftCount =
      currentLevel === 1
        ? Object.values(codes).filter((value) => value.trim().length > 0).length
        : currentLevel === 2
          ? Object.values(l2Answers).filter((value) => value.trim().length > 0).length
          : l3CodeDraft.trim().length > 0
            ? 1
            : 0;

    return {
      github,
      screen,
      level: currentLevel,
      expiresAt,
      totalProblems,
      draftCount,
      solvedLocal: Object.values(localPass).filter((value) => value === true).length,
      isSubmitting,
      isRestoringSession,
      submitError,
      submittedLead,
      results: results
        ? {
            elo: results.elo,
            solved: results.solved,
            rank: results.rank,
            timeRemaining: results.timeRemaining,
          }
        : undefined,
    };
  }, [
    codes,
    currentLevel,
    expiresAt,
    github,
    isRestoringSession,
    isSubmitting,
    l2Answers,
    l2Problems.length,
    l3Challenge,
    l3CodeDraft,
    localPass,
    results,
    screen,
    submitError,
    submittedLead,
    problems.length,
  ]);

  const snapshot = useMemo(() => {
    if (!sessionId) return null;

    if (results) {
      return {
        type: "results",
        currentLevel,
        results: {
          elo: results.elo,
          solved: results.solved,
          rank: results.rank,
          timeRemaining: results.timeRemaining,
        },
      };
    }

    if (screen === "playing" && currentLevel === 1) {
      return {
        type: "level1",
        problems: summarizeLevel1Problems(problems),
        codes,
        localPass,
      };
    }

    if (screen === "playing" && currentLevel === 2) {
      return {
        type: "level2",
        problems: summarizeLevel2Problems(l2Problems),
        answers: l2Answers,
      };
    }

    if (screen === "playing" && currentLevel === 3 && l3Challenge) {
      return {
        type: "level3",
        challenge: summarizeLevel3Challenge(l3Challenge),
        code: l3CodeDraft,
      };
    }

    return {
      type: "screen",
      currentLevel,
      screen,
    };
  }, [
    codes,
    currentLevel,
    l2Answers,
    l2Problems,
    l3Challenge,
    l3CodeDraft,
    localPass,
    problems,
    results,
    screen,
    sessionId,
  ]);

  const summaryJson = useMemo(() => JSON.stringify(summary), [summary]);
  const snapshotJson = useMemo(() => (snapshot ? JSON.stringify(snapshot) : null), [snapshot]);

  const emitReplayEvent = useEffectEvent(
    async (
      eventType: SessionReplayEventType,
      nextSummary: Record<string, unknown>,
      nextSnapshot?: Record<string, unknown> | null,
    ) => {
      if (!sessionId || !isAuthenticated) return;
      await postSessionReplayEvent({
        sessionId,
        level: currentLevel as 1 | 2 | 3,
        eventType,
        screen,
        summary: nextSummary,
        snapshot: nextSnapshot ?? undefined,
      });
    },
  );

  useEffect(() => {
    if (!sessionId || !isAuthenticated) return;
    const screenKey = `${sessionId}:${screen}:${currentLevel}`;
    if (screenKey === lastScreenKeyRef.current) return;
    const eventType: SessionReplayEventType =
      lastScreenKeyRef.current?.startsWith(`${sessionId}:`) === true
        ? "screen_changed"
        : "session_started";
    lastScreenKeyRef.current = screenKey;
    void emitReplayEvent(eventType, summary, snapshot);
  }, [currentLevel, isAuthenticated, screen, sessionId, snapshot, summary]);

  useEffect(() => {
    if (!sessionId || !isAuthenticated || !snapshotJson || !snapshot) return;
    if (snapshotJson === lastSnapshotJsonRef.current) return;
    const timeoutId = window.setTimeout(() => {
      lastSnapshotJsonRef.current = snapshotJson;
      void emitReplayEvent("state_snapshot", summary, snapshot);
    }, SNAPSHOT_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isAuthenticated, sessionId, snapshot, snapshotJson, summary]);

  useEffect(() => {
    if (!sessionId || !isAuthenticated) return;
    const resultsKey = results
      ? `${sessionId}:${results.elo}:${results.rank}:${results.solved}`
      : null;
    if (!resultsKey || resultsKey === lastResultsKeyRef.current) return;
    lastResultsKeyRef.current = resultsKey;
    void emitReplayEvent("results_viewed", summary, snapshot);
  }, [isAuthenticated, results, sessionId, snapshot, summary]);

  useEffect(() => {
    if (!sessionId || !isAuthenticated) return;
    const intervalId = window.setInterval(() => {
      void emitReplayEvent("heartbeat", JSON.parse(summaryJson) as Record<string, unknown>, null);
    }, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, sessionId, summaryJson]);
}
