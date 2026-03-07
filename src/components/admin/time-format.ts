export function formatRelative(timestamp: number) {
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 1_000) return "now";
  const seconds = Math.round(deltaMs / 1_000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}
