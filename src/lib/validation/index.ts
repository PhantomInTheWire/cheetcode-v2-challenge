import { LEVEL2_PROBLEMS, getLevel2ProblemById } from "../../../server/level2/problems";

const GITHUB_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const GITHUB_MAX = 39;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX = 254;
const X_HANDLE_RE = /^@?[a-zA-Z0-9_]{1,15}$/;
const CODE_MAX_BYTES = 10_000;

type Level2Answers = Record<string, string>;

export function validateGithub(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: "GitHub username is required" };
  if (value.length > GITHUB_MAX) return { ok: false, error: `Max ${GITHUB_MAX} characters` };
  if (!GITHUB_RE.test(value)) {
    return { ok: false, error: "Invalid GitHub username - letters, numbers, and hyphens only" };
  }
  return { ok: true, value };
}

export function validateEmail(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim().toLowerCase();
  if (!value) return { ok: false, error: "Email is required" };
  if (value.length > EMAIL_MAX) return { ok: false, error: "Email too long" };
  if (!EMAIL_RE.test(value)) return { ok: false, error: "Invalid email address" };
  return { ok: true, value };
}

export function validateXHandle(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true, value: "" };
  if (!X_HANDLE_RE.test(value)) return { ok: false, error: "Invalid X handle" };
  return { ok: true, value: value.startsWith("@") ? value.slice(1) : value };
}

export function validateCode(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (new TextEncoder().encode(raw).length > CODE_MAX_BYTES) {
    return { ok: false, error: "Code exceeds 10 KB limit" };
  }
  return { ok: true, value: raw };
}

export function validateLevel2Answers(
  answers: Level2Answers,
  allowedProblemIds?: string[],
): Array<{
  problemId: string;
  correct: boolean;
}> {
  const problems = allowedProblemIds
    ? allowedProblemIds
        .map((problemId) => getLevel2ProblemById(problemId))
        .filter((problem): problem is (typeof LEVEL2_PROBLEMS)[number] => Boolean(problem))
    : LEVEL2_PROBLEMS;

  return problems.map((problem) => {
    const userAnswer = (answers[problem.id] || "").trim().toLowerCase();
    const correctAnswer = problem.answer.trim().toLowerCase();
    const acceptable = [correctAnswer, ...(problem.acceptableAnswers || [])].map((answer) =>
      answer.trim().toLowerCase(),
    );

    return {
      problemId: problem.id,
      correct: acceptable.includes(userAnswer),
    };
  });
}
