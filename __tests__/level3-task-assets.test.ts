import { describe, expect, it } from "vitest";
import { resolveLevel3TaskAssetPath, resolveLevel3TaskAssets } from "../server/level3/taskAssets";
import { LEVEL3_ENABLED_TASKS } from "../server/level3/taskCatalog";

describe("level3 task assets", () => {
  it("loads enabled task assets for C", () => {
    for (const task of LEVEL3_ENABLED_TASKS) {
      const assets = resolveLevel3TaskAssets(task.id, "C");
      expect(assets.ext).toBe("c");
      expect(assets.specTemplate.trim().length).toBeGreaterThan(200);
      for (const exportName of [...new Set(task.checks.map((check) => check.exportName))]) {
        expect(assets.starterCode).toContain(exportName);
        expect(assets.solutionCode).toContain(exportName);
      }
      expect(assets.starterCode.trim().length).toBeLessThan(4000);
      expect(assets.solutionCode.trim().length).toBeGreaterThan(200);
      expect(assets.harnessSource.trim().length).toBeGreaterThan(200);
    }
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

  it("returns no auxiliary sources for the auth resolver task", () => {
    expect(
      resolveLevel3TaskAssets("identity-bundle-auth-resolver", "C").auxiliarySources,
    ).toEqual([]);
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
