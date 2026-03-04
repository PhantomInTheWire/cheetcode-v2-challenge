import {
  type Level3Check,
  type Level3ChallengeMeta,
  generateLevel3ChallengeMeta,
  getLevel3ChallengeMetaFromId,
} from "./catalog";
import { resolveLevel3TaskAssets } from "./taskAssets";

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

function renderSpec(specTemplate: string, language: string, ext: string): string {
  return specTemplate.replaceAll("{language}", language).replaceAll("{ext}", ext);
}

function hydrateChallenge(meta: Level3ChallengeMeta): Level3Challenge {
  const assets = resolveLevel3TaskAssets(meta.taskId, meta.language);
  return {
    ...meta,
    spec: renderSpec(assets.specTemplate, meta.language, assets.ext),
    starterCode: assets.starterCode,
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
