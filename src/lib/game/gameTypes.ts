import type { Id } from "../../../convex/_generated/dataModel";
import { TOTAL_SOLVE_TARGET } from "../config/constants";

export type Screen =
  | "landing"
  | "level2-prereq"
  | "level3-prereq"
  | "playing"
  | "results"
  | "level3-verification";
export type ProblemTier = "easy" | "medium" | "hard" | "competitive";

export type ProblemTestCase = {
  input: Record<string, unknown>;
  expected: unknown;
  args?: unknown[];
};

export type GameProblem = {
  id: string;
  title: string;
  tier: ProblemTier;
  description: string;
  signature: string;
  starterCode: string;
  testCases: ProblemTestCase[];
};

export type ExploitInfo = {
  id: string;
  bonus: number;
  message: string;
};

export type LandmineInfo = {
  id: string;
  penalty: number;
  message: string;
};

export type ResultsData = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  completedLevel?: boolean;
  scoreSnapshot?: ScoreSnapshot | null;
  exploits?: ExploitInfo[];
  landmines?: LandmineInfo[];
  validation?: {
    compiled: boolean;
    error: string;
    results: Array<{ problemId: string; name?: string; correct: boolean; message: string }>;
  };
};

export type ScoreSnapshot = {
  elo: number;
  solved: number;
  rank: number;
};

export type Level2Project = "chromium" | "firefox" | "libreoffice" | "postgres";
export type Level2Problem = { id: string; question: string; project: Level2Project };

export type Level3ChallengeState = {
  id: string;
  title: string;
  taskId?: string;
  taskName: string;
  language: string;
  spec: string;
  checks: { id: string; name: string }[];
  starterCode: string;
};

export type SessionPayloadBase<TSessionId extends string, TLevel extends 1 | 2 | 3, TProblems> = {
  sessionId: TSessionId;
  startedAt?: number;
  expiresAt: number;
  level: TLevel;
  problems: TProblems;
  scoreSnapshot?: ScoreSnapshot | null;
};

export type Level1SessionPayload<TSessionId extends string = Id<"sessions">> = SessionPayloadBase<
  TSessionId,
  1,
  GameProblem[]
>;
export type Level2SessionPayload<TSessionId extends string = Id<"sessions">> = SessionPayloadBase<
  TSessionId,
  2,
  Level2Problem[]
>;
export type Level3SessionPayload<TSessionId extends string = Id<"sessions">> = SessionPayloadBase<
  TSessionId,
  3,
  Level3ChallengeState[]
>;

export type RestoredSessionPayload<TSessionId extends string = Id<"sessions">> =
  | Level1SessionPayload<TSessionId>
  | Level2SessionPayload<TSessionId>
  | Level3SessionPayload<TSessionId>;

export type StoredSessionSnapshot = RestoredSessionPayload;

export type StoredFlowScreen = {
  screen: Extract<Screen, "level2-prereq" | "level3-prereq">;
  pendingLevel: 2 | 3;
};

export { TOTAL_SOLVE_TARGET };
