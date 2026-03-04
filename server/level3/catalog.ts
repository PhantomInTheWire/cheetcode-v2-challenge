import {
  LEVEL3_ENABLED_TASKS,
  type Level3TaskTemplate,
  type Level3TaskCheckTemplate,
} from "./taskCatalog";

export type Level3Check = {
  id: string;
  name: string;
  exportName: string;
};

export type Level3ChallengeMeta = {
  id: string;
  title: string;
  taskId: string;
  taskName: string;
  language: string;
  checks: Level3Check[];
};

function randomPick<T>(items: T[]): T {
  if (items.length === 0) {
    throw new Error("randomPick requires at least one item");
  }
  return items[Math.floor(Math.random() * items.length)];
}

function languageToKey(language: string): string {
  return language.toLowerCase().replace(/\+\+/g, "pp");
}

function keyToLanguage(key: string): "C" | "C++" | "Rust" | null {
  if (key === "c") return "C";
  if (key === "cpp") return "C++";
  if (key === "rust") return "Rust";
  return null;
}

function checksFor(challengeId: string, checks: Level3TaskCheckTemplate[]): Level3Check[] {
  return checks.map((check) => ({
    id: `${challengeId}:${check.key}`,
    name: check.name,
    exportName: check.exportName,
  }));
}

function challengeMetaForTaskAndLanguage(
  task: Level3TaskTemplate,
  language: string,
): Level3ChallengeMeta {
  const challengeId = `l3:${task.id}:${languageToKey(language)}`;
  return {
    id: challengeId,
    title: task.title ?? "Level 3 Systems Spec",
    taskId: task.id,
    taskName: task.name,
    language,
    checks: checksFor(challengeId, task.checks),
  };
}

export function generateLevel3ChallengeMeta(): Level3ChallengeMeta {
  const task = randomPick(LEVEL3_ENABLED_TASKS);
  const language = randomPick([...task.languages]);
  return challengeMetaForTaskAndLanguage(task, language);
}

export function getLevel3ChallengeMetaFromId(challengeId: string): Level3ChallengeMeta | null {
  const match = /^l3:([^:]+):([^:]+)$/.exec(challengeId);
  if (!match) return null;

  const [, taskId, languageKey] = match;
  const task = LEVEL3_ENABLED_TASKS.find((candidate) => candidate.id === taskId);
  const language = keyToLanguage(languageKey);
  if (!task || !language || !task.languages.includes(language)) return null;

  return challengeMetaForTaskAndLanguage(task, language);
}
