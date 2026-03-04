import { readLevel3TaskAsset } from "./taskAssets";

function buildRunnerSource(language: string, harnessBootstrap: string): string {
  return `
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const language = ${JSON.stringify(language)};
${harnessBootstrap}

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 10_000, killSignal: "SIGKILL" });
}

  function compileAndRun() {
  let compileResult;
  if (language === "C") {
    compileResult = run("clang", ["main.c", "harness.c", "-o", "harness"]);
  } else if (language === "C++") {
    compileResult = run("clang++", ["main.cpp", "harness.c", "-o", "harness"]);
  } else {
    const lib = run("rustc", ["--crate-type", "staticlib", "main.rs", "-o", "libuser.a"]);
    if (lib.status !== 0) return { compileResult: lib, runResult: null };
    compileResult = run("clang", ["harness.c", "libuser.a", "-o", "harness", "-lpthread", "-ldl", "-lm"]);
  }

  if (compileResult.status !== 0) return { compileResult, runResult: null };
  const runResult = run("./harness", []);
  return { compileResult, runResult };
}

function parseHarnessOutput(output) {
  const harness = {};
  for (const line of output.split(/\\r?\\n/)) {
    if (!line.trim()) continue;
    const [key, okText, ...rest] = line.split("|");
    harness[key] = { ok: okText === "1", message: rest.join("|") || "no message" };
  }
  return harness;
}

const { compileResult, runResult } = compileAndRun();
if (!compileResult || compileResult.status !== 0) {
  fs.writeFileSync("result.json", JSON.stringify({
    compiled: false,
    error: (compileResult?.stderr || compileResult?.stdout || "compile failed").toString().slice(0, 4000),
    harness: {}
  }), "utf8");
  process.exit(0);
}

if (!runResult || runResult.status !== 0) {
  fs.writeFileSync("result.json", JSON.stringify({
    compiled: true,
    error: (runResult?.stderr || runResult?.stdout || runResult?.signal || "harness failed").toString().slice(0, 4000),
    harness: {}
  }), "utf8");
  process.exit(0);
}

fs.writeFileSync("result.json", JSON.stringify({
  compiled: true,
  error: "",
  harness: parseHarnessOutput(runResult.stdout || "")
}), "utf8");
`.trim();
}

export function buildLevel3NativeSandboxRunner(taskId: string, language: string): string {
  const harnessSource = readLevel3TaskAsset(taskId, "harness.c");
  const harnessBootstrap = `const HARNESS_SOURCE = ${JSON.stringify(harnessSource)};
fs.writeFileSync("harness.c", HARNESS_SOURCE, "utf8");`;
  return buildRunnerSource(language, harnessBootstrap);
}

export function buildLevel3SandboxRuntimeRunner(_taskId: string, language: string): string {
  return buildRunnerSource(language, "");
}
