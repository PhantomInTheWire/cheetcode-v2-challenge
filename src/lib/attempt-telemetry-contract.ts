export const TELEMETRY_EVENT_TYPES = [
  "validate_l1",
  "validate_l2",
  "validate_l3",
  "finish_l1",
  "finish_l2",
  "finish_l3",
] as const;

export type TelemetryEventType = (typeof TELEMETRY_EVENT_TYPES)[number];

export const TELEMETRY_STATUSES = [
  "passed",
  "failed",
  "partial",
  "shadow_banned",
  "infra_error",
] as const;

export type TelemetryStatus = (typeof TELEMETRY_STATUSES)[number];

export const TELEMETRY_ERROR_TYPES = [
  "syntax",
  "runtime",
  "timeout",
  "wrong_answer",
  "compile",
  "invalid_request",
  "shadow_ban",
] as const;

export type TelemetryErrorType = (typeof TELEMETRY_ERROR_TYPES)[number];
