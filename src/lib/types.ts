export type ProblemTier = "easy" | "medium" | "hard" | "competitive";

export type ProblemTestCase = {
  input: Record<string, unknown>;
  expected: unknown;
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

export type SubmissionDraft = {
  problemId: string;
  code: string;
  tier: ProblemTier;
  testCases: ProblemTestCase[];
};

export type SessionResponse = {
  sessionId: string;
  expiresAt: number;
  problems: GameProblem[];
};

export type SubmissionResult = {
  problemId: string;
  passed: boolean;
};

export type SubmitResultsResponse = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  details: SubmissionResult[];
};
