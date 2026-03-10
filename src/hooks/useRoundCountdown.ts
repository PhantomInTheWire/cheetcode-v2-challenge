import { useMemo, useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 1000);
  return () => window.clearInterval(id);
}

function getSnapshot() {
  return Date.now();
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
