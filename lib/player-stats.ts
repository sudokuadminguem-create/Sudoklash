// Personal statistics that are computed rather than stored: streaks of days played and the
// series of times shown as a progression curve. Pure, so the server and the tests share it.

const parisDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day (YYYY-MM-DD) of an instant in Paris, the clock the challenges follow. */
export function dayKey(timestamp: number) {
  return parisDay.format(new Date(timestamp));
}

const DAY_MS = 86_400_000;
/** Number of days between two YYYY-MM-DD keys, ignoring daylight saving time. */
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export type Streak = {
  /** Consecutive days played up to today or yesterday; 0 once a whole day was missed. */
  current: number;
  best: number;
  /** Whether something was played today: a streak of 3 not yet extended today is at risk. */
  playedToday: boolean;
};

/**
 * Streaks of consecutive days with at least one result. A streak stays alive through the day
 * after the last result, so playing in the evening never breaks the one of the day before.
 */
export function streakOf(timestamps: readonly number[], now: number): Streak {
  const days = [...new Set(timestamps.map(dayKey))].sort();
  if (!days.length) return { current: 0, best: 0, playedToday: false };
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = dayKey(now);
  const gap = daysBetween(days[days.length - 1], today);
  return { current: gap <= 1 ? run : 0, best, playedToday: gap === 0 };
}

export type SoloResult = { difficulty: string; elapsed_seconds: number; completed_at: number };

/** The last `limit` results of a difficulty, oldest first, ready to be plotted. */
export function progressionFor(results: readonly SoloResult[], difficulty: string, limit = 30) {
  return results
    .filter((r) => r.difficulty === difficulty)
    .sort((a, b) => a.completed_at - b.completed_at)
    .slice(-limit);
}

/**
 * How the recent results compare with the ones before: negative when the player got faster.
 * Needs at least four results to say anything; averages the latest and previous halves.
 */
export function trendOf(results: readonly { elapsed_seconds: number }[]) {
  if (results.length < 4) return null;
  const half = Math.floor(results.length / 2);
  const mean = (list: readonly { elapsed_seconds: number }[]) =>
    list.reduce((sum, r) => sum + r.elapsed_seconds, 0) / list.length;
  const before = mean(results.slice(0, half));
  const after = mean(results.slice(-half));
  return { before, after, change: (after - before) / before };
}
