import { useMemo, useSyncExternalStore } from "react";

let currentNow = Date.now();
let intervalId: number | null = null;
const listeners = new Set<() => void>();

function emitChange() {
  currentNow = Date.now();
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  if (intervalId === null && typeof window !== "undefined") {
    intervalId = window.setInterval(emitChange, 1000);
  }

  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
  };
}

function getSnapshot() {
  return currentNow;
}

export function useRoundCountdown(expiresAt: number) {
  const now = useSyncExternalStore(subscribe, getSnapshot, () => 0);

  const timeLeftMs = useMemo(() => Math.max(0, expiresAt - now), [expiresAt, now]);

  return {
    now,
    timeLeftMs,
    timeUp: timeLeftMs === 0,
  };
}
