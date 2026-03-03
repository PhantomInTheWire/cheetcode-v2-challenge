import fs from "node:fs";
import path from "node:path";
import {
  type Level3Check,
  type Level3ChallengeMeta,
  generateLevel3ChallengeMeta,
  getLevel3ChallengeMetaFromId,
} from "./catalog";

type Level3Challenge = {
  id: string;
  title: string;
  taskId: string;
  taskName: string;
  language: string;
  spec: string;
  checks: Level3Check[];
  starterCode: string;
};

const ASSETS_DIR = path.join(process.cwd(), "server/level3/assets");

function languageToExt(language: string): string {
  if (language === "C") return "c";
  if (language === "C++") return "cpp";
  return "rs";
}

function starterCodeFor(language: string): string {
  return fs.readFileSync(path.join(ASSETS_DIR, `main.${languageToExt(language)}`), "utf8");
}

function renderSpec(language: string): string {
  const specTemplate = fs.readFileSync(path.join(ASSETS_DIR, "spec.md"), "utf8");
  return specTemplate
    .replaceAll("{language}", language)
    .replaceAll("{ext}", languageToExt(language));
}

function hydrateChallenge(meta: Level3ChallengeMeta): Level3Challenge {
  return {
    ...meta,
    spec: renderSpec(meta.language),
    starterCode: starterCodeFor(meta.language),
  };
}

export function generateLevel3Challenge(): Level3Challenge {
  return hydrateChallenge(generateLevel3ChallengeMeta());
}

export function getLevel3ChallengeFromId(challengeId: string): Level3Challenge | null {
  const meta = getLevel3ChallengeMetaFromId(challengeId);
  if (!meta) return null;
  return hydrateChallenge(meta);
}
