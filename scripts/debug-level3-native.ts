import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { getLevel3AutoSolveCode } from "../server/level3/autoSolve";
import { buildLevel3NativeSandboxRunner } from "../server/level3/sandboxRunner";
import { LEVEL3_ENABLED_TASKS } from "../server/level3/taskCatalog";

type NativeRunResult = {
  compiled: boolean;
  passed?: boolean;
  error?: string;
};

function failRun(
  taskId: string,
  language: "C" | "C++" | "Rust",
  reason: string,
  details?: Record<string, string | undefined>,
): never {
  console.error(`[level3-native-debug] ${reason} (${taskId}, ${language})`);
  for (const [label, value] of Object.entries(details ?? {})) {
    if (value) {
      console.error(`${label}:`);
      console.error(value);
    }
  }
  process.exit(1);
}

const completedRuns: string[] = [];

for (const task of LEVEL3_ENABLED_TASKS) {
  for (const language of ["C", "C++", "Rust"] as const) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "l3dbg-"));
    const ext = language === "C" ? "c" : language === "C++" ? "cpp" : "rs";
    fs.writeFileSync(path.join(dir, `main.${ext}`), getLevel3AutoSolveCode(language, task.id));
    fs.writeFileSync(
      path.join(dir, "runner.mjs"),
      buildLevel3NativeSandboxRunner(task.id, language),
    );

    const run = spawnSync("node", ["runner.mjs"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 20000,
    });
    if (run.error) {
      failRun(task.id, language, "runner error", { error: run.error.message });
    }

    const resultPath = path.join(dir, "result.json");
    if (!fs.existsSync(resultPath)) {
      failRun(task.id, language, "missing result.json", {
        stdout: run.stdout,
        stderr: run.stderr,
      });
    }

    const result = JSON.parse(fs.readFileSync(resultPath, "utf8")) as NativeRunResult;
    if (!result.compiled) {
      failRun(task.id, language, "compile failed", {
        error: result.error ?? "unknown compile error",
      });
    }

    completedRuns.push(`${task.id}:${language}`);
  }
}

console.log(
  JSON.stringify({
    status: "ok",
    tasks: LEVEL3_ENABLED_TASKS.length,
    runs: completedRuns.length,
    completedRuns,
  }),
);
