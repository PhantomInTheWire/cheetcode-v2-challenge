import { describe, expect, it } from "vitest";
import * as leaderboardModule from "../convex/leaderboard";
import * as leadsModule from "../convex/leads";
import schema from "../convex/schema";

describe("convex module exports", () => {
  it("exposes leaderboard queries", () => {
    expect(leaderboardModule.getAll).toBeTruthy();
    expect(leaderboardModule.getMyLevel).toBeTruthy();
  });

  it("exposes leads mutations/actions", () => {
    expect(leadsModule.submitInternal).toBeTruthy();
    expect(leadsModule.submit).toBeTruthy();
  });

  it("exports schema definition", () => {
    expect(schema).toBeTruthy();
  });
});
