import { describe, expect, it } from "vitest";
import { resolveLevel3TaskAssetPath, resolveLevel3TaskAssets } from "../server/level3/taskAssets";

describe("level3 task assets", () => {
  it("loads cpu task assets for C", () => {
    const assets = resolveLevel3TaskAssets("cpu-16bit-emulator", "C");
    expect(assets.ext).toBe("c");
    expect(assets.specTemplate.trim().length).toBeGreaterThan(200);
    expect(assets.starterCode).toContain("cpu_reset");
    expect(assets.starterCode).toContain("cpu_run");
    expect(assets.starterCode.trim().length).toBeLessThan(2500);
    expect(assets.solutionCode.trim().length).toBeGreaterThan(200);
    expect(assets.harnessSource.trim().length).toBeGreaterThan(200);
    expect(assets.auxiliarySources.map((source) => source.filename)).toEqual(["support.c"]);
  });

  it("loads language-specific auxiliary sources", () => {
    expect(
      resolveLevel3TaskAssets("cpu-16bit-emulator", "C++").auxiliarySources.map(
        (source) => source.filename,
      ),
    ).toEqual(["support.cpp"]);
    expect(
      resolveLevel3TaskAssets("cpu-16bit-emulator", "Rust").auxiliarySources.map(
        (source) => source.filename,
      ),
    ).toEqual(["support.rs"]);
  });

  it("returns explicit error when task asset is missing", () => {
    const missingPath = resolveLevel3TaskAssetPath("cpu-16bit-emulator", "does-not-exist.txt");
    expect(() => resolveLevel3TaskAssets("cpu-16bit-emulator", "Go")).toThrow(
      /Unsupported Level 3 language/i,
    );
    expect(() => {
      // Try to read a missing file using a valid language path.
      resolveLevel3TaskAssets("missing-task", "C");
    }).toThrow(/Missing level3 task asset/i);
    expect(missingPath).toContain("cpu-16bit-emulator");
  });
});
