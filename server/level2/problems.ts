import level2Questions from "../../data/level2-questions.json";

export const LEVEL2_PROJECTS = ["chromium", "firefox", "libreoffice", "postgres"] as const;
export type Level2Project = (typeof LEVEL2_PROJECTS)[number];
export type Level2ProjectPair = [Level2Project, Level2Project];

export type Level2Problem = {
  id: string;
  project: Level2Project;
  question: string;
  answer: string;
  acceptableAnswers?: string[];
};

export const LEVEL2_PROBLEM_SET_SIZE = 10;
export const LEVEL2_PROJECTS_PER_SESSION = 2;
export const LEVEL2_QUESTIONS_PER_PROJECT = LEVEL2_PROBLEM_SET_SIZE / LEVEL2_PROJECTS_PER_SESSION;

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
    const project = candidate.project;
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

    if (typeof project !== "string" || !LEVEL2_PROJECTS.includes(project as Level2Project)) {
      throw new Error(
        `Invalid Level 2 question '${id}': project must be one of ${LEVEL2_PROJECTS.join(", ")}`,
      );
    }

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
      project: project as Level2Project,
      question,
      answer,
      acceptableAnswers: acceptableAnswers as string[] | undefined,
    };
  });
}

/**
 * Level 2 Multi-Project Source Challenge.
 *
 * Bank includes Chromium, Firefox, LibreOffice, and Postgres prompts.
 * Each session draws exactly 2 projects and serves a 5+5 split.
 */
export const LEVEL2_PROBLEMS: Level2Problem[] = parseLevel2Problems(level2Questions);
export const LEVEL2_PROBLEMS_BY_ID = new Map(
  LEVEL2_PROBLEMS.map((problem) => [problem.id, problem] as const),
);

function shuffle<T>(array: readonly T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickRandomPair<T>(array: readonly T[]): [T, T] {
  if (array.length < 2) {
    throw new Error("need at least 2 items to pick a pair");
  }
  const shuffled = shuffle(array);
  return [shuffled[0], shuffled[1]];
}

export function pickLevel2ProjectPair(requestedProjects?: string[]): Level2ProjectPair {
  if (requestedProjects) {
    if (requestedProjects.length !== LEVEL2_PROJECTS_PER_SESSION) {
      throw new Error(
        `requested level2 project pair must include ${LEVEL2_PROJECTS_PER_SESSION} projects`,
      );
    }
    const unique = [...new Set(requestedProjects)];
    if (unique.length !== LEVEL2_PROJECTS_PER_SESSION) {
      throw new Error("requested level2 project pair must contain distinct projects");
    }
    for (const project of unique) {
      if (!LEVEL2_PROJECTS.includes(project as Level2Project)) {
        throw new Error(`invalid requested level2 project '${project}'`);
      }
    }
    return unique as Level2ProjectPair;
  }
  return pickRandomPair(LEVEL2_PROJECTS);
}

export function selectLevel2SessionProblems(requestedProjects?: string[]): Level2Problem[] {
  return selectLevel2SessionProblemsFromBank(LEVEL2_PROBLEMS, requestedProjects);
}

export function selectLevel2SessionProblemsFromBank(
  problems: Level2Problem[],
  requestedProjects?: string[],
): Level2Problem[] {
  if (problems.length < LEVEL2_PROBLEM_SET_SIZE) {
    throw new Error(
      `insufficient level2 problems: need ${LEVEL2_PROBLEM_SET_SIZE}, have ${problems.length}`,
    );
  }

  const problemsByProject = new Map<Level2Project, Level2Problem[]>();
  for (const project of LEVEL2_PROJECTS) {
    problemsByProject.set(
      project,
      problems.filter((problem) => problem.project === project),
    );
  }

  for (const project of LEVEL2_PROJECTS) {
    const count = problemsByProject.get(project)?.length ?? 0;
    if (count < LEVEL2_QUESTIONS_PER_PROJECT) {
      throw new Error(
        `insufficient level2 problems for project '${project}': need ${LEVEL2_QUESTIONS_PER_PROJECT}, have ${count}`,
      );
    }
  }

  const [projectA, projectB] = pickLevel2ProjectPair(requestedProjects);
  const selected = [
    ...shuffle(problemsByProject.get(projectA)!).slice(0, LEVEL2_QUESTIONS_PER_PROJECT),
    ...shuffle(problemsByProject.get(projectB)!).slice(0, LEVEL2_QUESTIONS_PER_PROJECT),
  ];
  return shuffle(selected);
}

export function getLevel2ProblemById(id: string): Level2Problem | undefined {
  return LEVEL2_PROBLEMS_BY_ID.get(id);
}
