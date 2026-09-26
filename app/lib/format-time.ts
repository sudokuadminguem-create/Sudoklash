const pad = (value: number) => String(value).padStart(2, "0");

/** Minutes and seconds, e.g. 07:05 (minutes keep growing past an hour). */
export function formatClock(seconds: number) {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

/** Duration with hours when needed, e.g. 07:05 or 01:02:03. Negative values show as 00:00. */
export function formatDuration(total: number) {
  const safe = Math.max(0, Math.floor(total));
  const hours = Math.floor(safe / 3600),
    minutes = Math.floor((safe % 3600) / 60),
    seconds = safe % 60;
  return hours
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}
