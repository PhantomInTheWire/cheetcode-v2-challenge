import fs from "node:fs";
import path from "node:path";

const assetsDir = path.join(process.cwd(), "server", "level3", "assets");

function readAsset(name: string): string {
  return fs.readFileSync(path.join(assetsDir, name), "utf8");
}

const SOLUTION_C = readAsset("solution.c");
const SOLUTION_CPP = readAsset("solution.cpp");
const SOLUTION_RS = readAsset("solution.rs");

export function getLevel3AutoSolveCode(language: string): string {
  if (language === "C") return SOLUTION_C;
  if (language === "C++") return SOLUTION_CPP;
  return SOLUTION_RS;
}
