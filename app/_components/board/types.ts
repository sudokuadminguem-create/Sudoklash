import type { LogicalStep } from "@/lib/sudoku-grader";

/** A hint on screen: where the digit goes and why, the digit itself shown on request. */
export type ShownHint = { index: number; number: number; step: LogicalStep | null };

/** What a solo win reports back: the XP earned, or null when nothing was saved. */
export type SolveResult = { xpGained: number; totalXp?: number } | null;
/** XP shown after a solo win, or where saving it stands. */
export type ExperienceState = number | "saving" | "guest" | "error" | null;
