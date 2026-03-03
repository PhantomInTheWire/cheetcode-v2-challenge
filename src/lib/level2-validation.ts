import { LEVEL2_PROBLEMS } from "../../server/level2/problems";

type Level2Answers = Record<string, string>;

export function validateLevel2Answers(answers: Level2Answers): Array<{
  problemId: string;
  correct: boolean;
}> {
  return LEVEL2_PROBLEMS.map((problem) => {
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
