import { describe, expect, it } from "vitest";
import { LEVEL3_TOTAL } from "../src/lib/constants";
import {
  LEVEL3_ENABLED_TASKS,
  LEVEL3_TASK_CATALOG,
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

  it("declares origin tags for the auth resolver task", () => {
    const authTask = LEVEL3_TASK_CATALOG.find(
      (task) => task.id === "identity-bundle-auth-resolver",
    );
    expect(authTask?.originTags).toEqual(
      expect.arrayContaining(["authentication_authorization_knowledge", "security_knowledge"]),
    );
  });

  it("uses generic visible check names for the auth resolver task", () => {
    const authTask = LEVEL3_TASK_CATALOG.find(
      (task) => task.id === "identity-bundle-auth-resolver",
    );
    expect(authTask?.checks.map((check) => check.name)).toEqual([
      "Behavior Bucket 1",
      "Behavior Bucket 2",
      "Behavior Bucket 3",
      "Behavior Bucket 4",
      "Update Bucket 1",
      "Update Bucket 2",
      "Update Bucket 3",
      "Update Bucket 4",
      "Scale Budget 1",
      "Scale Budget 2",
      "Scale Budget 3",
      "Scale Budget 4",
      "Scale Budget 5",
      "Scale Budget 6",
      "Scale Budget 7",
      "Scale Budget 8",
      "Scale Budget 9",
      "Scale Budget 10",
      "Scale Budget 11",
      "Scale Budget 12",
      "Scale Budget 13",
      "Scale Budget 14",
      "Scale Budget 15",
      "Scale Budget 16",
      "Scale Budget 17",
    ]);
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

  it("rejects duplicate origin tags", () => {
    expect(() =>
      validateLevel3TaskCatalog([
        {
          id: "dupe-tags",
          name: "Task",
          enabled: true,
          languages: ["C"],
          originTags: ["security_knowledge", "security_knowledge"],
          checks: makeChecks(LEVEL3_TOTAL),
        },
      ]),
    ).toThrow(/duplicate origin tag/i);
  });
});
