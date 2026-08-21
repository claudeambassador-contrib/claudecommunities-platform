const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function formatTimeAgo(iso: string, now = Date.now()): string {
  const delta = Math.max(0, now - Date.parse(iso));
  if (delta < MINUTE) {
    return "just now";
  }
  if (delta < HOUR) {
    const minutes = Math.floor(delta / MINUTE);
    return `${minutes}m ago`;
  }
  if (delta < DAY) {
    const hours = Math.floor(delta / HOUR);
    return `${hours}h ago`;
  }
  const days = Math.floor(delta / DAY);
  if (days < 7) {
    return `${days}d ago`;
  }
  return new Date(iso).toLocaleDateString();
}
