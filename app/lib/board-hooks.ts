import { useEffect, useState } from "react";
import { isMoveKey } from "@/app/lib/board-logic";

/** Seconds played, counting up once per second while `running`. */
export function useGameClock(initialSeconds: number, running: boolean) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return seconds;
}

export type BoardShortcuts = {
  digit: (n: number) => void;
  erase: () => void;
  toggleNotes: () => void;
  undo: () => void;
  redo?: () => void;
  /** Moves the selection for an arrow, Home, End or Page key; true when it handled the key. */
  move?: (key: string) => boolean;
};

/**
 * Keyboard play: 1-9 place a digit, Backspace erases, N toggles notes, Ctrl/⌘+Z undoes,
 * Ctrl/⌘+Shift+Z or Ctrl/⌘+Y redoes. The arrows, Home, End and Page keys move the selection while
 * the focus is on the page or in the grid, so they still work in menus and dialogs.
 */
export function useBoardShortcuts(shortcuts: BoardShortcuts) {
  // Registered after every render so the handlers always see the latest board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "9") shortcuts.digit(Number(e.key));
      if (e.key === "Backspace" || e.key === "Delete") shortcuts.erase();
      if (e.key.toLowerCase() === "n") shortcuts.toggleNotes();
      if (isMoveKey(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target instanceof Element ? e.target : null;
        const inGrid = !target || target === document.body || !!target.closest(".sudoku");
        if (inGrid && shortcuts.move?.(e.key)) e.preventDefault();
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) shortcuts.undo();
        if ((key === "z" && e.shiftKey) || key === "y") shortcuts.redo?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
}
