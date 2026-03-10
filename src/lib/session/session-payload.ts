import type { Id } from "../../../convex/_generated/dataModel";
import type {
  GameProblem,
  Level2Problem,
  Level3ChallengeState,
  Level1SessionPayload,
  Level2SessionPayload,
  Level3SessionPayload,
  RestoredSessionPayload,
  ScoreSnapshot,
} from "../gameTypes";

export type SessionEnvelopeInput<TSessionId extends string> = {
  sessionId: TSessionId;
  startedAt?: number;
  expiresAt: number;
  scoreSnapshot?: ScoreSnapshot | null;
};

function normalizeScoreSnapshot(
  scoreSnapshot: ScoreSnapshot | null | undefined,
): ScoreSnapshot | null {
  return scoreSnapshot ?? null;
}

export function buildSessionEnvelope<TSessionId extends string>(
  session: SessionEnvelopeInput<TSessionId>,
): SessionEnvelopeInput<TSessionId> & { scoreSnapshot: ScoreSnapshot | null } {
  return {
    ...session,
    scoreSnapshot: normalizeScoreSnapshot(session.scoreSnapshot),
  };
}

export function buildLevel1SessionPayload<TSessionId extends string>(
  session: SessionEnvelopeInput<TSessionId>,
  problems: GameProblem[],
): Level1SessionPayload<TSessionId> {
  return {
    ...buildSessionEnvelope(session),
    level: 1,
    problems,
  };
}

export function buildLevel2SessionPayload<TSessionId extends string>(
  session: SessionEnvelopeInput<TSessionId>,
  problems: Level2Problem[],
): Level2SessionPayload<TSessionId> {
  return {
    ...buildSessionEnvelope(session),
    level: 2,
    problems,
  };
}

export function buildLevel3SessionPayload<TSessionId extends string>(
  session: SessionEnvelopeInput<TSessionId>,
  problems: Level3ChallengeState[],
): Level3SessionPayload<TSessionId> {
  return {
    ...buildSessionEnvelope(session),
    level: 3,
    problems,
  };
}

type Level3ChallengeSource = {
  id: string;
  title: string;
  taskId?: string;
  taskName: string;
  language: string;
  spec: string;
  starterCode: string;
  checks: Array<{ id: string; name: string }>;
};

export function buildLevel3ChallengeState(challenge: Level3ChallengeSource): Level3ChallengeState {
  return {
    id: challenge.id,
    title: challenge.title,
    taskId: challenge.taskId,
    taskName: challenge.taskName,
    language: challenge.language,
    spec: challenge.spec,
    starterCode: challenge.starterCode,
    checks: challenge.checks.map((check) => ({ id: check.id, name: check.name })),
  };
}

export function getAssignedLevel3ChallengeId(problemIds: string[]): string | null {
  const assignedProblemId = problemIds[0];
  if (!assignedProblemId) return null;
  const lastSeparator = assignedProblemId.lastIndexOf(":");
  if (lastSeparator <= 0) return assignedProblemId;
  return assignedProblemId.slice(0, lastSeparator);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseScoreSnapshot(value: unknown): ScoreSnapshot | null {
  if (!isRecord(value)) return null;
  return {
    elo: typeof value.elo === "number" ? value.elo : 0,
    solved: typeof value.solved === "number" ? value.solved : 0,
    rank: typeof value.rank === "number" ? value.rank : 0,
  };
}

export function parseHydratableSessionPayload(
  value: unknown,
): RestoredSessionPayload<Id<"sessions">> | null {
  if (!isRecord(value) || !Array.isArray(value.problems)) return null;
  if (typeof value.sessionId !== "string") return null;
  if (
    typeof value.expiresAt !== "number" ||
    (value.level !== 1 && value.level !== 2 && value.level !== 3)
  ) {
    return null;
  }

  const session = {
    sessionId: value.sessionId as Id<"sessions">,
    startedAt: typeof value.startedAt === "number" ? value.startedAt : undefined,
    expiresAt: value.expiresAt,
    scoreSnapshot: parseScoreSnapshot(value.scoreSnapshot),
  };

  if (value.level === 1) {
    return buildLevel1SessionPayload(session, value.problems as GameProblem[]);
  }
  if (value.level === 2) {
    return buildLevel2SessionPayload(session, value.problems as Level2Problem[]);
  }
  return buildLevel3SessionPayload(session, value.problems as Level3ChallengeState[]);
}
