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

type SubmissionDraft = {
  problemId: string;
  code: string;
  tier: ProblemTier;
  testCases: ProblemTestCase[];
};

type SessionResponse = {
  sessionId: string;
  expiresAt: number;
  problems: GameProblem[];
};

type SubmissionResult = {
  problemId: string;
  passed: boolean;
};

type SubmitResultsResponse = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  details: SubmissionResult[];
};
