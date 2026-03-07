import type { ConvexHttpClient } from "convex/browser";
import { createHash } from "node:crypto";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import type { SessionReplayEventType } from "./session-replay-contract";

const MAX_JSON_LENGTH = 200_000;
const MAX_STRING_LENGTH = 20_000;
const MAX_PREVIEW_STRING_LENGTH = 320;
const MAX_PREVIEW_ARRAY_ITEMS = 12;

function truncateStrings(
  value: unknown,
  maxStringLength: number,
  maxArrayItems: number = Number.POSITIVE_INFINITY,
): unknown {
  if (typeof value === "string") {
    if (value.length <= maxStringLength) return value;
    return `${value.slice(0, maxStringLength)}...[truncated ${value.length - maxStringLength} chars]`;
  }

  if (Array.isArray(value)) {
    const sliced = value
      .slice(0, maxArrayItems)
      .map((entry) => truncateStrings(entry, maxStringLength));
    if (value.length <= maxArrayItems) return sliced;
    return [...sliced, { truncatedItems: value.length - maxArrayItems }];
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        truncateStrings(entry, maxStringLength, maxArrayItems),
      ]),
    );
  }

  return value;
}

function stringifyPayload(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) return undefined;
  const raw = JSON.stringify(payload);
  if (raw.length <= MAX_JSON_LENGTH) return raw;
  return JSON.stringify({
    truncated: true,
    payload: truncateStrings(payload, MAX_STRING_LENGTH),
  });
}

function buildSnapshotPreview(snapshot: Record<string, unknown> | undefined): string | undefined {
  if (!snapshot) return undefined;
  return JSON.stringify(
    truncateStrings(snapshot, MAX_PREVIEW_STRING_LENGTH, MAX_PREVIEW_ARRAY_ITEMS),
  );
}

type SessionReplayEventInput = {
  convex: ConvexHttpClient;
  secret: string;
  sessionId: Id<"sessions">;
  github: string;
  level: 1 | 2 | 3;
  eventType: SessionReplayEventType;
  screen: string;
  route: string;
  clientAt?: number;
  summary: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
};

type ConvexActionCaller = (reference: unknown, args: Record<string, unknown>) => Promise<unknown>;

export async function recordSessionReplayEvent(input: SessionReplayEventInput): Promise<void> {
  const snapshotJson = stringifyPayload(input.snapshot);
  const snapshotPreviewJson = buildSnapshotPreview(input.snapshot);

  try {
    const callAction = input.convex.action as unknown as ConvexActionCaller;
    await callAction(
      (api as typeof api & { sessionReplay: { recordEvent: unknown } }).sessionReplay.recordEvent,
      {
        secret: input.secret,
        sessionId: input.sessionId,
        github: input.github,
        level: input.level,
        eventType: input.eventType,
        screen: input.screen,
        route: input.route,
        createdAt: Date.now(),
        clientAt: input.clientAt,
        summaryJson: JSON.stringify(input.summary),
        snapshotJson,
        snapshotPreviewJson,
        snapshotHash: snapshotJson
          ? createHash("sha256").update(snapshotJson, "utf8").digest("hex")
          : undefined,
        snapshotSize: snapshotJson ? Buffer.byteLength(snapshotJson, "utf8") : undefined,
      },
    );
  } catch (error) {
    console.error("[session-replay] failed to record event", error);
  }
}
