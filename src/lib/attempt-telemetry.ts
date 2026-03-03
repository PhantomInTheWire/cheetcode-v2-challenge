import type { ConvexHttpClient } from "convex/browser";
import { createHash } from "node:crypto";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { ENV } from "./env-vars";
import type {
  TelemetryErrorType,
  TelemetryEventType,
  TelemetryStatus,
} from "./attempt-telemetry-contract";

const MAX_JSON_LENGTH = 100_000;
const MAX_STRING_LENGTH = 20_000;

function truncateValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => truncateValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, truncateValue(entry)]),
    );
  }

  return value;
}

function stringifyPayload(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) return undefined;
  const raw = JSON.stringify(payload);
  if (raw.length <= MAX_JSON_LENGTH) return raw;
  return JSON.stringify({
    artifactTruncated: true,
    payload: truncateValue(payload),
  });
}

type TelemetryEventInput = {
  convex: ConvexHttpClient;
  sessionId: Id<"sessions">;
  github: string;
  level: 1 | 2 | 3;
  eventType: TelemetryEventType;
  elapsedMs?: number;
  route: string;
  status: TelemetryStatus;
  errorType?: TelemetryErrorType;
  solvedCount?: number;
  passCount?: number;
  failCount?: number;
  summary: Record<string, unknown>;
  artifact?: Record<string, unknown>;
};

type TelemetryBaseInput = Omit<TelemetryEventInput, "summary"> & {
  summary?: Record<string, unknown>;
};

export function buildTelemetryEvent(input: TelemetryBaseInput): TelemetryEventInput {
  return {
    ...input,
    summary: {
      route: input.route,
      level: input.level,
      eventType: input.eventType,
      status: input.status,
      elapsedMs: input.elapsedMs,
      solvedCount: input.solvedCount,
      passCount: input.passCount,
      failCount: input.failCount,
      errorType: input.errorType,
      ...(input.summary ?? {}),
    },
  };
}

export async function recordAttemptTelemetry(input: TelemetryEventInput): Promise<void> {
  try {
    const artifactJson = stringifyPayload(input.artifact);
    await input.convex.action(
      (api as typeof api & { attemptTelemetry: { recordEvent: unknown } }).attemptTelemetry
        .recordEvent,
      {
        secret: ENV.CONVEX_MUTATION_SECRET,
        sessionId: input.sessionId,
        github: input.github,
        level: input.level,
        eventType: input.eventType,
        createdAt: Date.now(),
        elapsedMs: input.elapsedMs,
        route: input.route,
        status: input.status,
        errorType: input.errorType,
        solvedCount: input.solvedCount,
        passCount: input.passCount,
        failCount: input.failCount,
        artifactHash: artifactJson
          ? createHash("sha256").update(artifactJson, "utf8").digest("hex")
          : undefined,
        artifactSize: artifactJson ? Buffer.byteLength(artifactJson, "utf8") : undefined,
        summaryJson: JSON.stringify(input.summary),
        artifactJson,
      },
    );
  } catch (error) {
    console.error("[attempt-telemetry] failed to record event", error);
  }
}

export async function recordBuiltTelemetry(input: TelemetryBaseInput): Promise<void> {
  await recordAttemptTelemetry(buildTelemetryEvent(input));
}
