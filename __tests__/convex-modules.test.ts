import * as attemptTelemetryModule from "../convex/attemptTelemetry";
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

  it("exposes attempt telemetry functions", () => {
    expect(attemptTelemetryModule.recordEventInternal).toBeTruthy();
    expect(attemptTelemetryModule.recordEvent).toBeTruthy();
    expect(attemptTelemetryModule.getSessionTimeline).toBeTruthy();
    expect(attemptTelemetryModule.getGithubTelemetry).toBeTruthy();
    expect(attemptTelemetryModule.getSessionRollup).toBeTruthy();
  });

  it("exports schema definition", () => {
    expect(schema).toBeTruthy();
  });
});
