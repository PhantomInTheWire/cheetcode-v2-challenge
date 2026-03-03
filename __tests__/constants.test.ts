import { describe, expect, it } from "vitest";
import {
  GAME_DESCRIPTION,
  LEVEL2_TOTAL,
  LEVEL3_TOTAL,
  PROBLEMS_PER_SESSION,
  ROUND_DURATION_MS,
  ROUND_DURATION_SECONDS,
  TOTAL_SOLVE_TARGET,
} from "../src/lib/constants";

describe("constants", () => {
  it("keeps duration units consistent", () => {
    expect(ROUND_DURATION_MS).toBe(ROUND_DURATION_SECONDS * 1000);
  });

  it("keeps total solve target derived correctly", () => {
    expect(TOTAL_SOLVE_TARGET).toBe(PROBLEMS_PER_SESSION + LEVEL2_TOTAL + LEVEL3_TOTAL);
  });

  it("includes core values in game description", () => {
    expect(GAME_DESCRIPTION).toContain(`${PROBLEMS_PER_SESSION} problems`);
    expect(GAME_DESCRIPTION).toContain(`${ROUND_DURATION_SECONDS} seconds`);
  });
});
