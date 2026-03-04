import type { Id } from "../../convex/_generated/dataModel";
import { TOTAL_SOLVE_TARGET } from "@/lib/constants";

export type Screen = "landing" | "level2-prereq" | "level3-prereq" | "playing" | "results";
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
  exploits?: ExploitInfo[];
  landmines?: LandmineInfo[];
  validation?: {
    compiled: boolean;
    error: string;
    results: Array<{ problemId: string; correct: boolean; message: string }>;
  };
};

export type Level2Problem = { id: string; question: string };

export type Level3ChallengeState = {
  id: string;
  title: string;
  taskName: string;
  language: string;
  spec: string;
  checks: { id: string; name: string }[];
  starterCode: string;
};

export type RestoredSessionPayload = {
  sessionId: Id<"sessions">;
  level: number;
  expiresAt: number;
  problems: unknown[];
};

export type StoredSessionSnapshot = {
  sessionId: Id<"sessions">;
  level: number;
  expiresAt: number;
  problems: unknown[];
};

export type StoredFlowScreen = {
  screen: Extract<Screen, "level2-prereq" | "level3-prereq">;
  pendingLevel: 2 | 3;
};

export { TOTAL_SOLVE_TARGET };
