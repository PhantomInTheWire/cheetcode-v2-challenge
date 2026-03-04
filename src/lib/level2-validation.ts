import { LEVEL2_PROBLEMS, getLevel2ProblemById } from "../../server/level2/problems";

type Level2Answers = Record<string, string>;

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
    const acceptable = [correctAnswer, ...(problem.acceptableAnswers || [])].map((a) =>
      a.trim().toLowerCase(),
    );

    return {
      problemId: problem.id,
      correct: acceptable.includes(userAnswer),
    };
  });
}
