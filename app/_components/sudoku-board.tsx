"use client";
import { useEffect, useRef, useState } from "react";
import { formatClock } from "@/app/lib/format-time";
import {
  completedDigitsOf,
  hintUnitCells,
  isConfirmed,
  MAX_MISTAKES,
  notesAfterPlacing,
  personalRecord,
  progressPercent,
  sameUnit,
  shareText,
  stepBack,
  toggleNote,
  type HistoryStep,
  type Notes,
  type Verdicts,
} from "@/app/lib/board-logic";
import { useBoardShortcuts, useGameClock } from "@/app/lib/board-hooks";
import type { Entry, Judge } from "@/app/lib/judge";
import { useSettings } from "@/app/lib/settings";
import type { BoardSnapshot } from "@/app/lib/solo-save";
import type { Difficulty } from "@/lib/difficulties";
import { nextLogicalStep } from "@/lib/sudoku-grader";
import { BoardHeader, RaceBar, ReadyGate } from "./board/board-header";
import { GameActions, HintPanel, Keypad } from "./board/board-controls";
import { BoardNotices, GameFooter, LossResult, VictoryPanel } from "./board/game-results";
import { SudokuGrid } from "./board/sudoku-grid";
import type { ExperienceState, ShownHint, SolveResult } from "./board/types";
import { ConfirmDialog } from "./confirm-dialog";

type SudokuBoardProps = {
  /** Grid to play, 0 for empty cells. */
  puzzle: number[];
  /** Says whether each placed digit is correct. */
  judge: Judge;
  difficulty?: Difficulty;
  competitive?: boolean;
  title?: string;
  active?: boolean;
  initialSeconds?: number;
  initialMistakes?: number;
  onSolved?: (
    grid: number[],
    elapsedSeconds: number,
    puzzle: number[],
  ) => void | SolveResult | Promise<void | SolveResult>;
  /** Correct cells (givens included) after each confirmed entry. */
  onProgress?: (correct: number, grid: number[]) => void;
  /** Offers a "new grid" button when set. */
  onNewGame?: () => void;
  onReady?: () => void;
  readyBusy?: boolean;
  challengeLabel?: string;
  race?: { meName: string; opponentName: string; opponentProgress: number; totalToFill?: number };
  storageKey?: string;
  hintsAllowed?: number;
  soloExperience?: boolean;
  onConnect?: () => void;
  /** State of a game saved earlier, to carry on from. */
  resume?: BoardSnapshot;
  /** Called as the game changes so it can be saved; null once it is won or lost. */
  onSnapshot?: (snapshot: BoardSnapshot | null) => void;
  /** Best time on this difficulty before this game: null before a first win, unset to hide. */
  previousBest?: number | null;
};

export function SudokuBoard({
  puzzle,
  judge,
  difficulty = "Intermédiaire",
  competitive = false,
  title = "Arène éclair",
  active = true,
  initialSeconds = 0,
  initialMistakes = 0,
  onSolved,
  onProgress,
  onNewGame,
  onReady,
  readyBusy = false,
  challengeLabel = "GRILLE HEBDOMADAIRE",
  race,
  storageKey,
  hintsAllowed,
  soloExperience = false,
  onConnect,
  resume,
  onSnapshot,
  previousBest,
}: SudokuBoardProps) {
  const { settings } = useSettings();
  const replayable = !!onNewGame;
  const [cells, setCells] = useState(() =>
      (resume?.cells ?? puzzle).map((value, index) =>
        value && resume?.verdicts.wrong[index] === value ? 0 : value,
      ),
    ),
    [selected, setSelected] = useState<number | null>(null),
    [noteMode, setNoteMode] = useState(false),
    [cellNotes, setCellNotes] = useState<Notes>(() => resume?.notes ?? {}),
    [done, setDone] = useState(false),
    [experience, setExperience] = useState<ExperienceState>(null),
    [experienceTotal, setExperienceTotal] = useState<number | null>(null),
    [history, setHistory] = useState<HistoryStep[]>([]),
    [mistakes, setMistakes] = useState(resume?.mistakes ?? initialMistakes),
    [hintsUsed, setHintsUsed] = useState(resume?.hintsUsed ?? 0),
    // Digits whose check could not reach the judge.
    [failedEntries, setFailedEntries] = useState<Entry[]>([]),
    [mistakesLoaded, setMistakesLoaded] = useState(!storageKey),
    [shownHint, setShownHint] = useState<ShownHint | null>(null),
    [confirmingNewGame, setConfirmingNewGame] = useState(false);
  // Accepted digits are locked; rejected digits remain in the verdict history for undo.
  const [verdicts, setVerdicts] = useState<Verdicts>(
    () => resume?.verdicts ?? { correct: {}, wrong: {} },
  );
  const seconds = useGameClock(
    resume?.seconds ?? initialSeconds,
    !done && active && mistakes < MAX_MISTAKES,
  );
  const verdictsRef = useRef(verdicts);
  const [errorCells, setErrorCells] = useState<Record<number, boolean>>({});
  const errorTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  useEffect(
    () => () => {
      Object.values(errorTimers.current).forEach(clearTimeout);
    },
    [],
  );
  const clearError = (index: number) => {
    clearTimeout(errorTimers.current[index]);
    delete errorTimers.current[index];
    setErrorCells((current) => {
      if (!current[index]) return current;
      const next = { ...current };
      delete next[index];
      return next;
    });
  };
  const flashError = (index: number) => {
    clearTimeout(errorTimers.current[index]);
    setErrorCells((current) => ({ ...current, [index]: true }));
    errorTimers.current[index] = setTimeout(() => clearError(index), 4000);
  };
  // Entries sent to the judge whose verdict has not come back yet, by id.
  const pendingRef = useRef<Record<string, Entry>>({});
  // Latest grid, for verdicts that come back after other digits were placed.
  const cellsRef = useRef(cells);
  const updateCells = (grid: number[]) => {
    cellsRef.current = grid;
    setCells(grid);
  };
  const isCorrect = (grid: number[], i: number) =>
    isConfirmed(puzzle, verdictsRef.current, grid, i);
  const isWrong = (i: number) => !!errorCells[i];
  const recordVerdict = (entry: Entry, correct: boolean) => {
    const next = {
      ...verdictsRef.current,
      correct: correct
        ? { ...verdictsRef.current.correct, [entry.index]: entry.number }
        : verdictsRef.current.correct,
      wrong: { ...verdictsRef.current.wrong },
    };
    if (correct) delete next.wrong[entry.index];
    else next.wrong[entry.index] = entry.number;
    verdictsRef.current = next;
    setVerdicts(next);
  };
  const hintLimit = hintsAllowed ?? (race ? 1 : competitive ? 0 : 3);
  useEffect(() => {
    if (!storageKey) return;
    const saved = Number(window.localStorage.getItem(storageKey));
    const savedHints = Number(window.localStorage.getItem(`${storageKey}:hints`));
    setMistakes(Number.isInteger(saved) ? Math.max(0, Math.min(3, saved)) : 0);
    setHintsUsed(Number.isInteger(savedHints) ? Math.max(0, Math.min(1, savedHints)) : 0);
    setMistakesLoaded(true);
  }, [storageKey]);
  const finish = (grid: number[]) => {
    setDone(true);
    if (soloExperience) {
      setExperience("saving");
      void Promise.resolve()
        .then(() => onSolved?.(grid, Math.max(1, seconds), puzzle))
        .then((result) => {
          setExperienceTotal(result && typeof result === "object" ? result.totalXp ?? null : null);
          setExperience(result && typeof result === "object" ? result.xpGained : "guest");
        })
        .catch(() => setExperience("error"));
    } else onSolved?.(grid, Math.max(1, seconds), puzzle);
  };
  const submit = async (entry: Entry, grid: number[]) => {
    setFailedEntries((list) => list.filter((e) => e.id !== entry.id));
    pendingRef.current[entry.id] = entry;
    try {
      const verdict = await judge.check(entry, grid).finally(() => {
        delete pendingRef.current[entry.id];
      });
      if (verdict.correct) {
        clearError(entry.index);
        recordVerdict(entry, true);
        // Other digits may have been placed since: count against the board as it is now.
        let current = cellsRef.current;
        if (current[entry.index] !== entry.number) {
          current = [...current];
          current[entry.index] = entry.number;
          updateCells(current);
        }
        const correctCells = current.filter((_, i) => isCorrect(current, i)).length;
        onProgress?.(correctCells, current);
        if (correctCells === 81) finish(current);
        return;
      }
      // A late wrong verdict must not erase a newer entry in the same cell.
      if (cellsRef.current[entry.index] === entry.number) {
        recordVerdict(entry, false);
        const current = [...cellsRef.current];
        current[entry.index] = 0;
        updateCells(current);
        flashError(entry.index);
      }
      if (settings.vibrate) navigator.vibrate?.(180);
      // Several checks can be in flight and answer out of order: never let the count go back.
      setMistakes((previous) => {
        const count = Math.min(3, Math.max(previous, verdict.mistakes ?? previous + 1));
        if (storageKey) window.localStorage.setItem(storageKey, String(count));
        return count;
      });
    } catch {
      setFailedEntries((list) => [...list, entry]);
    }
  };
  // Entries whose check failed and whose digit is still on the board; the others are moot.
  const unverified = failedEntries.filter((e) => cells[e.index] === e.number);
  // Digits confirmed in all nine places: there is nowhere left to put them.
  const completedDigits = completedDigitsOf(cells, puzzle, verdicts);
  const retryFailed = () => {
    setFailedEntries([]);
    for (const entry of unverified) void submit(entry, cells);
  };
  const input = (n: number, index = selected, forceValue = false) => {
    if (
      completedDigits.has(n) ||
      !mistakesLoaded ||
      !active ||
      index === null ||
      puzzle[index] ||
      isCorrect(cellsRef.current, index) ||
      done ||
      mistakes >= 3 ||
      cells[index] === n
    )
      return;
    setHistory((h) => [...h.slice(-39), { cells: [...cells], notes: { ...cellNotes } }]);
    if (noteMode && !competitive && !forceValue) {
      setCellNotes((prev) => toggleNote(prev, index, n));
      return;
    }
    const c = [...cells];
    c[index] = n;
    clearError(index);
    if (verdictsRef.current.wrong[index] !== undefined) {
      const wrong = { ...verdictsRef.current.wrong };
      delete wrong[index];
      const next = { ...verdictsRef.current, wrong };
      verdictsRef.current = next;
      setVerdicts(next);
    }
    updateCells(c);
    // The placed digit is no longer a candidate in its row, column and box.
    setCellNotes((prev) => notesAfterPlacing(prev, index, n, settings.autoRemoveNotes));
    void submit({ index, number: n, id: crypto.randomUUID() }, c);
  };
  const erase = () => {
    if (
      selected === null ||
      puzzle[selected] ||
      isCorrect(cellsRef.current, selected) ||
      mistakes >= 3
    )
      return;
    setHistory((h) => [...h, { cells: [...cells], notes: { ...cellNotes } }]);
    const c = [...cells];
    c[selected] = 0;
    updateCells(c);
    setCellNotes((p) => ({ ...p, [selected]: [] }));
  };
  const undo = () => {
    if (mistakes >= 3) return;
    const last = history.at(-1);
    if (!last) return;
    const restored = stepBack(last, verdictsRef.current, cellsRef.current);
    updateCells(restored.cells);
    setCellNotes(restored.notes);
    setHistory((h) => h.slice(0, -1));
  };
  // Digits restored from a save whose check never came back: ask again, with the same ids
  // so a mistake the server already counted is not counted twice.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !resume) return;
    resumedRef.current = true;
    for (const entry of resume.pending)
      if (cellsRef.current[entry.index] === entry.number) void submit(entry, cellsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!onSnapshot) return;
    if (done || mistakes >= 3) {
      onSnapshot(null);
      return;
    }
    const pending = [...Object.values(pendingRef.current), ...failedEntries].filter(
      (e) => cells[e.index] === e.number,
    );
    onSnapshot({ cells, notes: cellNotes, seconds, mistakes, hintsUsed, verdicts, pending });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, cellNotes, seconds, mistakes, hintsUsed, verdicts, failedEntries, done]);
  useBoardShortcuts({
    digit: (n) => input(n),
    erase,
    toggleNotes: () => {
      if (!competitive) setNoteMode((v) => !v);
    },
    undo,
  });
  const filled = cells.filter(Boolean).length,
    givens = puzzle.filter(Boolean).length,
    raceProgress = race?.totalToFill
      ? cells.filter((_, i) => !puzzle[i] && isCorrect(cells, i)).length
      : filled,
    unsolved = cells.some((_, i) => !isCorrect(cells, i)),
    raceTotal = race?.totalToFill ?? 81,
    time = formatClock(seconds),
    selectedValue = selected === null ? 0 : cells[selected];
  const related = (i: number) =>
    settings.highlightUnits && selected !== null && sameUnit(i, selected);
  // A hint is over once its digit is on the board, or the game is.
  const hint =
    shownHint && cells[shownHint.index] !== shownHint.number && !done && mistakes < 3
      ? shownHint
      : null;
  const hintCells = hint ? hintUnitCells(hint.index, hint.step?.unit?.cells) : new Set<number>();
  const patternCells = new Set(hint?.step?.pattern?.cells ?? []);
  const requestHint = async () => {
    if (
      !judge.hint ||
      !mistakesLoaded ||
      !active ||
      done ||
      mistakes >= 3 ||
      hintsUsed >= hintLimit
    )
      return;
    // Reason from the digits known to be right only: a wrong one would mislead the logic.
    const known = cells.map((v, i) => (isCorrect(cells, i) ? v : 0));
    const step = nextLogicalStep(known);
    const given = await judge.hint(cells, step?.index).catch(() => null);
    if (!given) return;
    setHintsUsed(hintsUsed + 1);
    if (storageKey) window.localStorage.setItem(`${storageKey}:hints`, String(hintsUsed + 1));
    setSelected(given.index);
    setShownHint({ ...given, step: step?.index === given.index ? step : null });
  };
  const revealHint = () => {
    if (!hint) return;
    setSelected(hint.index);
    input(hint.number, hint.index, true);
    setShownHint(null);
  };
  // A grid with digits of the player's own is not thrown away without asking.
  const started =
    cells.some((v, i) => v && !puzzle[i]) || Object.values(cellNotes).some((n) => n.length);
  const newGame = () => {
    if (settings.confirmNewGrid && started && !done && mistakes < 3) setConfirmingNewGame(true);
    else onNewGame?.();
  };
  const record = personalRecord(previousBest, seconds);
  const lost = mistakes >= MAX_MISTAKES;
  const eyebrow = `${
    hintsAllowed === 0 && race
      ? "PARTIE CLASSÉE"
      : race
        ? "PARTIE PRIVÉE"
        : competitive
          ? "DÉFI"
          : "PARTIE NORMALE"
  } · ${difficulty.toUpperCase()}`;
  return (
    <div
      className={`game-card ${!active ? "weekly-gated" : ""} ${lost ? "lost" : ""} ${done ? "solved" : ""} ${settings.largeDigits ? "large-digits" : ""}`}
    >
      <BoardHeader
        eyebrow={eyebrow}
        title={title}
        mistakes={mistakes}
        time={time}
        showTimer={settings.showTimer}
      />
      {!active && onReady && (
        <ReadyGate label={challengeLabel} busy={readyBusy} onReady={onReady} />
      )}
      {race && (
        <RaceBar
          meName={race.meName}
          opponentName={race.opponentName}
          progress={raceProgress}
          opponentProgress={race.opponentProgress}
          total={raceTotal}
        />
      )}
      <SudokuGrid
        cells={cells}
        puzzle={puzzle}
        notes={cellNotes}
        difficulty={difficulty}
        selected={selected}
        selectedValue={selectedValue}
        highlightSame={settings.highlightSame}
        lost={lost}
        won={done}
        hintTarget={hint?.index}
        hintCells={hintCells}
        patternCells={patternCells}
        isWrong={isWrong}
        isLocked={(i) => isCorrect(cells, i) && !puzzle[i]}
        isUnverified={(i) => unverified.some((e) => e.index === i && e.number === cells[i])}
        isRelated={related}
        onSelect={(i) => active && setSelected(i)}
      />
      <Keypad
        selectedValue={selectedValue}
        completed={completedDigits}
        disabled={lost}
        onDigit={(n) => input(n)}
      />
      <GameActions
        lost={lost}
        competitive={competitive}
        noteMode={noteMode}
        canUndo={history.length > 0}
        hintsLeft={hintLimit - hintsUsed}
        hintDisabled={
          !active ||
          !judge.hint ||
          !mistakesLoaded ||
          done ||
          hintLimit === 0 ||
          hintsUsed >= hintLimit ||
          lost ||
          !unsolved
        }
        canAbandon={replayable}
        onToggleNotes={() => setNoteMode(!noteMode)}
        onErase={erase}
        onUndo={undo}
        onHint={() => void requestHint()}
        onAbandon={newGame}
      />
      {hint && <HintPanel hint={hint} onReveal={revealHint} onDismiss={() => setShownHint(null)} />}
      <GameFooter
        hintLimit={hintLimit}
        hintsUsed={hintsUsed}
        progress={progressPercent(filled, givens)}
        competitive={competitive}
      />
      <BoardNotices mistakes={mistakes} unverified={unverified.length} onRetry={retryFailed} />
      {lost && <LossResult onNewGame={onNewGame} />}
      {done && (
        <VictoryPanel
          difficulty={difficulty}
          time={time}
          mistakes={mistakes}
          hintsUsed={hintsUsed}
          record={record}
          soloExperience={soloExperience}
          experience={experience}
          experienceTotal={experienceTotal}
          shareText={shareText({ title, difficulty, time, mistakes, hintsUsed })}
          onConnect={onConnect}
          onNewGame={onNewGame}
        />
      )}
      {confirmingNewGame && (
        <ConfirmDialog
          title="Abandonner cette grille ?"
          message="Ta progression sur la grille en cours sera perdue."
          confirmLabel="Abandonner et relancer"
          cancelLabel="Continuer la partie"
          onCancel={() => setConfirmingNewGame(false)}
          onConfirm={() => {
            setConfirmingNewGame(false);
            onNewGame?.();
          }}
        />
      )}
    </div>
  );
}
