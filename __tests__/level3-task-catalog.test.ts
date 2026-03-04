import { describe, expect, it } from "vitest";
import { LEVEL3_TOTAL } from "../src/lib/constants";
import {
  LEVEL3_ENABLED_TASKS,
  validateLevel3TaskCatalog,
  type Level3TaskCheckTemplate,
} from "../server/level3/taskCatalog";

function makeChecks(total: number): Level3TaskCheckTemplate[] {
  return Array.from({ length: total }, (_, index) => ({
    key: `check_${index + 1}`,
    name: `Check ${index + 1}`,
    exportName: "cpu_run",
  }));
}

describe("level3 task catalog validation", () => {
  it("has at least one enabled task", () => {
    expect(LEVEL3_ENABLED_TASKS.length).toBeGreaterThan(0);
  });

  it("rejects duplicate task ids", () => {
    const checks = makeChecks(LEVEL3_TOTAL);
    expect(() =>
      validateLevel3TaskCatalog([
        {
          id: "same",
          name: "Task A",
          enabled: true,
          languages: ["C"],
          checks,
        },
        {
          id: "same",
          name: "Task B",
          enabled: true,
          languages: ["C"],
          checks,
        },
      ]),
    ).toThrow(/duplicate task id/i);
  });

  it("rejects duplicate check keys", () => {
    expect(() =>
      validateLevel3TaskCatalog([
        {
          id: "dupe-checks",
          name: "Task",
          enabled: true,
          languages: ["C"],
          checks: [
            ...makeChecks(LEVEL3_TOTAL - 1),
            { key: "check_1", name: "Duplicate", exportName: "cpu_run" },
          ],
        },
      ]),
    ).toThrow(/duplicate check key/i);
  });

  it("rejects enabled task with non-25 checks", () => {
    expect(() =>
      validateLevel3TaskCatalog([
        {
          id: "wrong-count",
          name: "Task",
          enabled: true,
          languages: ["C"],
          checks: makeChecks(LEVEL3_TOTAL - 1),
        },
      ]),
    ).toThrow(/exactly 25 checks/i);
  });

  it("rejects unsupported languages", () => {
    expect(() =>
      validateLevel3TaskCatalog([
        {
          id: "bad-lang",
          name: "Task",
          enabled: true,
          languages: ["Go"],
          checks: makeChecks(LEVEL3_TOTAL),
        },
      ]),
    ).toThrow(/unsupported language/i);
  });
});
