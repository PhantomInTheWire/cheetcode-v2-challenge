import fs from "node:fs";
import path from "node:path";

const LEVEL3_TASKS_DIR = path.join(process.cwd(), "server", "level3", "tasks");

const extByLanguage: Record<string, "c" | "cpp" | "rs"> = {
  C: "c",
  "C++": "cpp",
  Rust: "rs",
};

const assetCache = new Map<string, string>();

export function languageToExt(language: string): "c" | "cpp" | "rs" {
  const ext = extByLanguage[language];
  if (!ext) {
    throw new Error(`Unsupported Level 3 language: ${language}`);
  }
  return ext;
}

export function resolveLevel3TaskDir(taskId: string): string {
  return path.join(LEVEL3_TASKS_DIR, taskId);
}

export function resolveLevel3TaskAssetPath(taskId: string, filename: string): string {
  return path.join(resolveLevel3TaskDir(taskId), filename);
}

export function readLevel3TaskAsset(taskId: string, filename: string): string {
  const cacheKey = `${taskId}/${filename}`;
  const cached = assetCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const filePath = resolveLevel3TaskAssetPath(taskId, filename);
  try {
    const content = fs.readFileSync(filePath, "utf8");
    assetCache.set(cacheKey, content);
    return content;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Missing level3 task asset '${taskId}/${filename}' at ${filePath}: ${message}`);
  }
}

export function resolveLevel3TaskAssets(taskId: string, language: string): {
  specTemplate: string;
  starterCode: string;
  harnessSource: string;
  solutionCode: string;
  ext: "c" | "cpp" | "rs";
} {
  const ext = languageToExt(language);
  return {
    specTemplate: readLevel3TaskAsset(taskId, "spec.md"),
    starterCode: readLevel3TaskAsset(taskId, `main.${ext}`),
    harnessSource: readLevel3TaskAsset(taskId, "harness.c"),
    solutionCode: readLevel3TaskAsset(taskId, `solution.${ext}`),
    ext,
  };
}
