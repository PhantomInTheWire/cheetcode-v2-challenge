import level2Questions from "../../data/level2-questions.json";

export type Level2Problem = {
  id: string;
  question: string;
  answer: string;
  acceptableAnswers?: string[];
};

export const LEVEL2_PROBLEM_SET_SIZE = 10;

function parseLevel2Problems(raw: unknown): Level2Problem[] {
  if (!Array.isArray(raw)) {
    throw new Error("Invalid Level 2 question bank: expected an array");
  }

  const seenIds = new Set<string>();

  return raw.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid Level 2 question at index ${index}: expected object`);
    }

    const candidate = item as Record<string, unknown>;
    const id = candidate.id;
    const question = candidate.question;
    const answer = candidate.answer;
    const acceptableAnswers = candidate.acceptableAnswers;

    if (typeof id !== "string" || id.trim().length === 0) {
      throw new Error(`Invalid Level 2 question at index ${index}: id must be non-empty string`);
    }
    if (seenIds.has(id)) {
      throw new Error(`Invalid Level 2 question bank: duplicate id '${id}'`);
    }
    seenIds.add(id);

    if (typeof question !== "string" || question.trim().length === 0) {
      throw new Error(`Invalid Level 2 question '${id}': question must be non-empty string`);
    }

    if (typeof answer !== "string" || answer.trim().length === 0) {
      throw new Error(`Invalid Level 2 question '${id}': answer must be non-empty string`);
    }

    if (
      acceptableAnswers !== undefined &&
      (!Array.isArray(acceptableAnswers) ||
        acceptableAnswers.some((entry) => typeof entry !== "string"))
    ) {
      throw new Error(
        `Invalid Level 2 question '${id}': acceptableAnswers must be an array of strings`,
      );
    }

    return {
      id,
      question,
      answer,
      acceptableAnswers: acceptableAnswers as string[] | undefined,
    };
  });
}

/**
 * Level 2 Chromium Search Challenge
 * Target: Chromium commit 69c7c0a024efdc5bec0a9075e306e180b51e4278
 *
 * Each question requires tracing logic across >= 10 files and >= 4 subsystems,
 * crossing at least one process boundary. Questions use plain English synonyms
 * and no code literals to force broad search.
 */
export const LEVEL2_PROBLEMS: Level2Problem[] = parseLevel2Problems(level2Questions);
export const LEVEL2_PROBLEMS_BY_ID = new Map(
  LEVEL2_PROBLEMS.map((problem) => [problem.id, problem] as const),
);

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function selectLevel2SessionProblems(): Level2Problem[] {
  if (LEVEL2_PROBLEMS.length < LEVEL2_PROBLEM_SET_SIZE) {
    throw new Error(
      `insufficient level2 problems: need ${LEVEL2_PROBLEM_SET_SIZE}, have ${LEVEL2_PROBLEMS.length}`,
    );
  }
  return shuffle(LEVEL2_PROBLEMS).slice(0, LEVEL2_PROBLEM_SET_SIZE);
}

export function getLevel2ProblemById(id: string): Level2Problem | undefined {
  return LEVEL2_PROBLEMS_BY_ID.get(id);
}
