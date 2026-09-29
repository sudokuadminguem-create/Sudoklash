import { useEffect, useState } from "react";

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
};

/**
 * Keyboard play: 1-9 place a digit, Backspace erases, N toggles notes, Ctrl/⌘+Z undoes,
 * Ctrl/⌘+Shift+Z or Ctrl/⌘+Y redoes.
 */
export function useBoardShortcuts(shortcuts: BoardShortcuts) {
  // Registered after every render so the handlers always see the latest board.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "9") shortcuts.digit(Number(e.key));
      if (e.key === "Backspace" || e.key === "Delete") shortcuts.erase();
      if (e.key.toLowerCase() === "n") shortcuts.toggleNotes();
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
