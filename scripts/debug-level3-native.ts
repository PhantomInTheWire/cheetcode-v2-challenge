import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { getLevel3AutoSolveCode } from "../server/level3/autoSolve";
import { buildLevel3NativeSandboxRunner } from "../server/level3/sandboxRunner";
import { LEVEL3_ENABLED_TASKS } from "../server/level3/taskCatalog";

for (const task of LEVEL3_ENABLED_TASKS) {
  for (const language of ["C", "C++", "Rust"] as const) {
    console.log(`START ${task.id} ${language}`);
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
      console.log(`RUNNER_ERROR ${task.id} ${language}`);
      console.log(run.error.message);
      process.exit(1);
    }

    const resultPath = path.join(dir, "result.json");
    if (!fs.existsSync(resultPath)) {
      console.log(`NO_RESULT ${task.id} ${language}`);
      if (run.stdout) console.log(run.stdout);
      if (run.stderr) console.log(run.stderr);
      process.exit(1);
    }

    const result = JSON.parse(fs.readFileSync(resultPath, "utf8")) as {
      compiled: boolean;
      passed?: boolean;
      error?: string;
    };
    if (!result.compiled) {
      console.log(`COMPILE_FAIL ${task.id} ${language}`);
      console.log(result.error ?? "unknown compile error");
      process.exit(1);
    }
  }
}

console.log("ALL_OK");
