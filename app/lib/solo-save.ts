import type { Entry } from "@/app/lib/judge";
import { isSoloDifficulty, type Difficulty } from "@/lib/difficulties";

/** A solo grid as the server handed it out. Guests get the solution to check locally. */
export type StartedGame =
  | { guest: true; puzzle: number[]; solution: number[] }
  | { guest: false; gameId: string; puzzle: number[] };

/** Everything the board needs to pick a game back up where the player left it. */
export type BoardSnapshot = {
  cells: number[];
  notes: Record<number, number[]>;
  seconds: number;
  mistakes: number;
  hintsUsed: number;
  verdicts: { correct: Record<number, number>; wrong: Record<number, number> };
  /** Digits still on the board whose check had not come back: checked again on resume. */
  pending: Entry[];
};

/** A solo game in progress, kept in the browser until it is won, lost or replaced. */
export type SoloSave = { difficulty: Difficulty; game: StartedGame; board: BoardSnapshot };

// The server keeps one open game per player, so one save per player is enough.
const keyFor = (userId: string | null | undefined) => `sudoklash:solo-save:${userId ?? "guest"}`;

export function loadSoloSave(userId: string | null | undefined): SoloSave | null {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const save = JSON.parse(raw) as SoloSave;
    const { board, game } = save;
    if (
      !isSoloDifficulty(save.difficulty) ||
      game?.guest !== !userId ||
      game.puzzle?.length !== 81 ||
      board?.cells?.length !== 81
    )
      return null;
    return save;
  } catch {
    return null;
  }
}

export function storeSoloSave(userId: string | null | undefined, save: SoloSave) {
  try {
    window.localStorage.setItem(keyFor(userId), JSON.stringify(save));
  } catch {
    // Storage full or blocked: the game goes on, it just won't survive a reload.
  }
}

export function clearSoloSave(userId: string | null | undefined) {
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // Nothing to clear.
  }
}

/** Share of the empty cells the player has filled. */
export function saveProgress({ game, board }: SoloSave) {
  const empty = game.puzzle.filter((v) => !v).length;
  const filled = board.cells.filter((v, i) => v && !game.puzzle[i]).length;
  return empty ? Math.round((filled / empty) * 100) : 0;
}
