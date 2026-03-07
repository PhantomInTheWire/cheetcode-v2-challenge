export const SESSION_REPLAY_EVENT_TYPES = [
  "session_started",
  "screen_changed",
  "state_snapshot",
  "heartbeat",
  "results_viewed",
] as const;

export type SessionReplayEventType = (typeof SESSION_REPLAY_EVENT_TYPES)[number];
