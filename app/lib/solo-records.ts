/** Best solo time per difficulty, in seconds, kept on this device. */
type Records = Partial<Record<string, number>>;

const keyFor = (userId: string | null | undefined) => `sudoklash:solo-records:${userId ?? "guest"}`;

function load(userId: string | null | undefined): Records {
  try {
    return JSON.parse(window.localStorage.getItem(keyFor(userId)) ?? "{}") as Records;
  } catch {
    return {};
  }
}

/** Best time for this difficulty, or null before a first win. */
export function soloRecord(userId: string | null | undefined, difficulty: string) {
  const best = load(userId)[difficulty];
  return typeof best === "number" && best > 0 ? best : null;
}

/** Keeps `seconds` when it beats the record. */
export function recordSoloWin(
  userId: string | null | undefined,
  difficulty: string,
  seconds: number,
) {
  const records = load(userId);
  const best = records[difficulty];
  if (typeof best === "number" && best > 0 && best <= seconds) return;
  try {
    window.localStorage.setItem(
      keyFor(userId),
      JSON.stringify({ ...records, [difficulty]: seconds }),
    );
  } catch {
    // Not kept: the next win will try again.
  }
}
