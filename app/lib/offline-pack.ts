// A few spare guest grids kept in the browser, so a solo game can start without a connection.
// They are practice games: nobody signed in earns XP from them, since the server never saw them.

import { soloDifficulties, type Difficulty } from "@/lib/difficulties";

export type OfflineGrid = { puzzle: number[]; solution: number[] };
type Pack = Partial<Record<Difficulty, OfflineGrid[]>>;

/** Spare grids kept per difficulty. */
export const PACK_SIZE = 2;
const STORAGE_KEY = "sudoklash:offline-pack";

const validGrid = (value: unknown): value is OfflineGrid => {
  const grid = value as OfflineGrid | null;
  return (
    !!grid &&
    Array.isArray(grid.puzzle) &&
    Array.isArray(grid.solution) &&
    grid.puzzle.length === 81 &&
    grid.solution.length === 81
  );
};

export function readPack(): Pack {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    return Object.fromEntries(
      soloDifficulties.flatMap((level) => {
        const grids = saved[level];
        return Array.isArray(grids) ? [[level, grids.filter(validGrid)]] : [];
      }),
    );
  } catch {
    return {};
  }
}

function writePack(pack: Pack) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pack));
  } catch {
    // Storage full or blocked: no offline grids, the app still works online.
  }
}

/** Takes one spare grid out of the pack, or null when there is none for this difficulty. */
export function takeOfflineGrid(level: Difficulty): OfflineGrid | null {
  const pack = readPack();
  const [next, ...rest] = pack[level] ?? [];
  if (!next) return null;
  writePack({ ...pack, [level]: rest });
  return next;
}

/** Asks the server for guest grids until every difficulty has its spares. */
export async function refillPack(fetchGrid: (level: Difficulty) => Promise<OfflineGrid>) {
  for (const level of soloDifficulties) {
    for (let missing = PACK_SIZE - (readPack()[level]?.length ?? 0); missing > 0; missing--) {
      let grid: OfflineGrid;
      try {
        grid = await fetchGrid(level);
      } catch {
        return; // Offline or busy: try again on the next visit.
      }
      if (!validGrid(grid)) return;
      const pack = readPack();
      writePack({ ...pack, [level]: [...(pack[level] ?? []), grid] });
    }
  }
}
