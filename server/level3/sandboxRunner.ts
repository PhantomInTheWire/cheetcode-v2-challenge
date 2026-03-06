import { resolveLevel3TaskAssets } from "./taskAssets";

function buildRunnerSource(
  language: string,
  supportFilenames: string[],
  bootstrapSource: string,
): string {
  return `
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const language = ${JSON.stringify(language)};
const supportFilenames = ${JSON.stringify(supportFilenames)};
${bootstrapSource}

function run(cmd, args) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 30_000, killSignal: "SIGKILL" });
}

function compileAndRun() {
  let compileResult;
  if (language === "C") {
    compileResult = run("clang", ["main.c", ...supportFilenames, "harness.c", "-o", "harness"]);
  } else if (language === "C++") {
    compileResult = run("clang++", ["main.cpp", ...supportFilenames, "harness.c", "-o", "harness"]);
  } else {
    const rustSupportFiles = supportFilenames.filter((name) => name.endsWith(".rs"));
    const rustSupportLibs = [];
    for (let idx = 0; idx < rustSupportFiles.length; idx++) {
      const file = rustSupportFiles[idx];
      const libName = "libsupport" + idx + ".a";
      const supportLib = run("rustc", ["--crate-type", "staticlib", file, "-o", libName]);
      if (supportLib.status !== 0) return { compileResult: supportLib, runResult: null };
      rustSupportLibs.push(libName);
    }
    const lib = run("rustc", ["--crate-type", "staticlib", "main.rs", "-o", "libuser.a"]);
    if (lib.status !== 0) return { compileResult: lib, runResult: null };
    compileResult = run("clang", ["harness.c", "libuser.a", ...rustSupportLibs, "-o", "harness", "-lpthread", "-ldl", "-lm"]);
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
  const assets = resolveLevel3TaskAssets(taskId, language);
  const bootstrapLines = [
    `const HARNESS_SOURCE = ${JSON.stringify(assets.harnessSource)};`,
    `fs.writeFileSync("harness.c", HARNESS_SOURCE, "utf8");`,
    ...assets.auxiliarySources.map(
      (source, index) =>
        `const SUPPORT_SOURCE_${index} = ${JSON.stringify(source.content)};
fs.writeFileSync(${JSON.stringify(source.filename)}, SUPPORT_SOURCE_${index}, "utf8");`,
    ),
  ];
  return buildRunnerSource(
    language,
    assets.auxiliarySources.map((source) => source.filename),
    bootstrapLines.join("\n"),
  );
}

export function buildLevel3SandboxRuntimeRunner(taskId: string, language: string): string {
  const assets = resolveLevel3TaskAssets(taskId, language);
  return buildRunnerSource(
    language,
    assets.auxiliarySources.map((source) => source.filename),
    "",
  );
}
