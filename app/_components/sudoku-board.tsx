"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Eraser,
  Flame,
  Heart,
  Lightbulb,
  Pencil,
  RotateCcw,
  Share2,
  ShieldCheck,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { formatClock } from "@/app/lib/format-time";
import { hintText } from "@/app/lib/hint-text";
import type { Entry, Judge } from "@/app/lib/judge";
import { useSettings } from "@/app/lib/settings";
import type { BoardSnapshot } from "@/app/lib/solo-save";
import type { Difficulty } from "@/lib/difficulties";
import { nextLogicalStep, type LogicalStep } from "@/lib/sudoku-grader";
import { ConfirmDialog } from "./confirm-dialog";

/** What a solo win reports back: the XP earned, or null when nothing was saved. */
type SolveResult = { xpGained: number } | null;
/** XP shown after a solo win, or where saving it stands. */
type ExperienceState = number | "saving" | "guest" | "error" | null;

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

/** A hint on screen: where the digit goes and why, the digit itself shown on request. */
type ShownHint = { index: number; number: number; step: LogicalStep | null };

/** Whether two cells share a row, a column or a 3×3 box. */
const sameUnit = (a: number, b: number) =>
  a % 9 === b % 9 ||
  Math.floor(a / 9) === Math.floor(b / 9) ||
  (Math.floor(a / 27) === Math.floor(b / 27) &&
    Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3));

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
    [cellNotes, setCellNotes] = useState<Record<number, number[]>>(() => resume?.notes ?? {}),
    [seconds, setSeconds] = useState(resume?.seconds ?? initialSeconds),
    [done, setDone] = useState(false),
    [experience, setExperience] = useState<ExperienceState>(null),
    [history, setHistory] = useState<{ cells: number[]; notes: Record<number, number[]> }[]>([]),
    [mistakes, setMistakes] = useState(resume?.mistakes ?? initialMistakes),
    [hintsUsed, setHintsUsed] = useState(resume?.hintsUsed ?? 0),
    // Digits whose check could not reach the judge.
    [failedEntries, setFailedEntries] = useState<Entry[]>([]),
    [mistakesLoaded, setMistakesLoaded] = useState(!storageKey),
    [shownHint, setShownHint] = useState<ShownHint | null>(null),
    [confirmingNewGame, setConfirmingNewGame] = useState(false),
    [shared, setShared] = useState(false);
  // Accepted digits are locked. Rejected digits keep their empty cell marked until retried.
  const [verdicts, setVerdicts] = useState<{
    correct: Record<number, number>;
    wrong: Record<number, number>;
  }>(() => resume?.verdicts ?? { correct: {}, wrong: {} });
  const verdictsRef = useRef(verdicts);
  // Entries sent to the judge whose verdict has not come back yet, by id.
  const pendingRef = useRef<Record<string, Entry>>({});
  // Latest grid, for verdicts that come back after other digits were placed.
  const cellsRef = useRef(cells);
  const updateCells = (grid: number[]) => {
    cellsRef.current = grid;
    setCells(grid);
  };
  const isCorrect = (grid: number[], i: number) =>
    !!puzzle[i] || (!!grid[i] && verdictsRef.current.correct[i] === grid[i]);
  const isWrong = (i: number) =>
    !puzzle[i] && verdicts.wrong[i] !== undefined && (!cells[i] || verdicts.wrong[i] === cells[i]);
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
  useEffect(() => {
    if (done || !active || mistakes >= 3) return;
    const t = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [done, active, mistakes]);
  const finish = (grid: number[]) => {
    setDone(true);
    if (soloExperience) {
      setExperience("saving");
      void Promise.resolve()
        .then(() => onSolved?.(grid, Math.max(1, seconds), puzzle))
        .then((result) =>
          setExperience(result && typeof result === "object" ? result.xpGained : "guest"),
        )
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
  const completedDigits = new Set(
    [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
      (n) =>
        cells.filter((v, i) => v === n && (puzzle[i] === n || verdicts.correct[i] === n)).length ===
        9,
    ),
  );
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
      setCellNotes((prev) => ({
        ...prev,
        [index]: (prev[index] || []).includes(n)
          ? (prev[index] || []).filter((x) => x !== n)
          : [...(prev[index] || []), n].sort(),
      }));
      return;
    }
    const c = [...cells];
    c[index] = n;
    if (verdictsRef.current.wrong[index] !== undefined) {
      const wrong = { ...verdictsRef.current.wrong };
      delete wrong[index];
      const next = { ...verdictsRef.current, wrong };
      verdictsRef.current = next;
      setVerdicts(next);
    }
    updateCells(c);
    // The placed digit is no longer a candidate in its row, column and box.
    setCellNotes((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([key, notes]) => {
          const i = Number(key);
          if (i === index) return [key, []];
          const drop = settings.autoRemoveNotes && sameUnit(i, index);
          return [key, drop ? notes.filter((x) => x !== n) : notes];
        }),
      ),
    );
    void submit({ index, number: n, id: crypto.randomUUID() }, c);
  };
  const erase = () => {
    if (selected === null || puzzle[selected] || isCorrect(cellsRef.current, selected) || mistakes >= 3) return;
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
    const restored = [...last.cells];
    const notes = { ...last.notes };
    for (const [key, number] of Object.entries(verdictsRef.current.wrong))
      if (restored[Number(key)] === number) restored[Number(key)] = 0;
    for (const [key, number] of Object.entries(verdictsRef.current.correct)) {
      const index = Number(key);
      if (cellsRef.current[index] === number) {
        restored[index] = number;
        notes[index] = [];
      }
    }
    updateCells(restored);
    setCellNotes(notes);
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
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key >= "1" && e.key <= "9") input(Number(e.key));
      if (e.key === "Backspace" || e.key === "Delete") erase();
      if (e.key.toLowerCase() === "n" && !competitive) setNoteMode((v) => !v);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") undo();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
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
  const hintCells = new Set(
    hint
      ? (hint.step?.unit?.cells ?? cells.map((_, i) => i).filter((i) => sameUnit(i, hint.index)))
      : [],
  );
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
  const share = async () => {
    const lives = "❤️".repeat(Math.max(0, 3 - mistakes)) + "🤍".repeat(Math.min(3, mistakes));
    const text = `Sudoku Clash · ${title} ${difficulty}\n⏱ ${time} ${lives} 💡 ${hintsUsed}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        setShared(true);
      }
    } catch {
      // Sharing cancelled or not allowed: nothing to do.
    }
  };
  const record =
    previousBest === undefined
      ? null
      : previousBest === null
        ? { label: "Premier record établi", best: true }
        : seconds < previousBest
          ? { label: `Nouveau record · −${formatClock(previousBest - seconds)}`, best: true }
          : { label: `Record : ${formatClock(previousBest)}`, best: false };
  return (
    <div
      className={`game-card ${!active ? "weekly-gated" : ""} ${mistakes >= 3 ? "lost" : ""} ${done ? "solved" : ""} ${settings.largeDigits ? "large-digits" : ""}`}
    >
      <div className="game-top">
        <div>
          <span className="eyebrow">
            {hintsAllowed === 0 && race
              ? "PARTIE CLASSÉE"
              : race
                ? "PARTIE PRIVÉE"
                : competitive
                  ? "DÉFI"
                  : "PARTIE NORMALE"}{" "}
            · {difficulty.toUpperCase()}
          </span>
          <h2>{title}</h2>
        </div>
        <div className="game-status">
          <div
            className="lives"
            role="status"
            aria-label={`${Math.max(0, 3 - mistakes)} ${3 - mistakes === 1 ? "vie restante" : "vies restantes"} sur 3`}
          >
            {[0, 1, 2].map((i) => (
              <Heart
                key={i}
                className={i < 3 - mistakes ? "full" : "empty"}
                fill={i < 3 - mistakes ? "currentColor" : "none"}
              />
            ))}
          </div>
          {settings.showTimer && (
            <div className="timer">
              <Timer />
              {time}
            </div>
          )}
        </div>
      </div>
      {!active && onReady && (
        <div className="ready-gate">
          <Flame />
          <span>{challengeLabel}</span>
          <h3>À vous de jouer</h3>
          <p>
            La grille restera masquée jusqu’au départ. Le chronomètre démarre dès que vous appuyez
            sur « Prêt ».
          </p>
          <button onClick={onReady} disabled={readyBusy}>
            {readyBusy ? "Démarrage…" : "Je suis prêt"}
          </button>
          <small>Une seule tentative jusqu’à la prochaine grille</small>
        </div>
      )}
      {race && (
        <div className="opponents">
          <span className="me">
            <i />
            {race.meName}{" "}
            <b>
              {raceProgress}/{raceTotal}
            </b>
          </span>
          <div className="race">
            <em style={{ width: `${(raceProgress / raceTotal) * 100}%` }} />
          </div>
          <span>
            <i />
            {race.opponentName}{" "}
            <b>
              {race.opponentProgress}/{raceTotal}
            </b>
          </span>
        </div>
      )}
      <div
        className="sudoku"
        role="grid"
        aria-label={`Grille de Sudoku 9 par 9, niveau ${difficulty}`}
      >
        {Array.from({ length: 9 }, (_, row) => (
          <div
            key={row}
            role="row"
            className={`sudoku-row ${row === 2 || row === 5 ? "block-bottom" : ""}`}
          >
            {cells.slice(row * 9, row * 9 + 9).map((v, col) => {
              const i = row * 9 + col,
                sameValue = settings.highlightSame && selectedValue > 0 && v === selectedValue,
                wrong = isWrong(i),
                locked = isCorrect(cells, i) && !puzzle[i],
                failed = !!v && unverified.some((e) => e.index === i && e.number === v);
              return (
                <button
                  key={i}
                  role="gridcell"
                  aria-rowindex={row + 1}
                  aria-colindex={col + 1}
                  aria-selected={selected === i}
                  aria-readonly={!!puzzle[i] || locked}
                  aria-invalid={wrong || undefined}
                  aria-label={`Case ligne ${row + 1}, colonne ${col + 1}${v ? `, chiffre ${v}${locked ? ", validé et verrouillé" : ""}` : wrong ? ", erreur, case vide" : `, vide${cellNotes[i]?.length ? `, notes ${cellNotes[i].join(", ")}` : ""}`}`}
                  disabled={mistakes >= 3}
                  onClick={() => active && setSelected(i)}
                  className={`${puzzle[i] ? "given" : "entered"} ${selected === i ? "sel" : ""} ${related(i) ? "line" : ""} ${sameValue ? "same" : ""} ${wrong ? "wrong" : ""} ${locked ? "confirmed" : ""} ${failed ? "unverified" : ""} ${hint?.index === i ? "hint-target" : hintCells.has(i) ? "hint-unit" : ""}`}
                  style={done ? ({ "--wave": row + col } as CSSProperties) : undefined}
                >
                  {v ||
                    (cellNotes[i]?.length ? (
                      <span className="cell-notes">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <i key={n}>{cellNotes[i].includes(n) ? n : ""}</i>
                        ))}
                      </span>
                    ) : (
                      ""
                    ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="keypad" aria-label="Clavier numérique">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            aria-label={completedDigits.has(n) ? `Chiffre ${n} complété` : `Placer le chiffre ${n}`}
            aria-pressed={selectedValue === n}
            disabled={mistakes >= 3 || completedDigits.has(n)}
            className={`${selectedValue === n ? "active-number" : ""} ${completedDigits.has(n) ? "completed-digit" : ""}`}
            onClick={() => input(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="game-actions">
        <button
          aria-label="Activer ou désactiver les notes"
          disabled={competitive || mistakes >= 3}
          onClick={() => setNoteMode(!noteMode)}
          className={noteMode ? "active" : ""}
        >
          <Pencil />
          Notes <small>N</small>
        </button>
        <button aria-label="Effacer la case sélectionnée" disabled={mistakes >= 3} onClick={erase}>
          <Eraser />
          Effacer
        </button>
        <button
          aria-label="Annuler la dernière action"
          onClick={undo}
          disabled={!history.length || mistakes >= 3}
        >
          <RotateCcw />
          Annuler
        </button>
        <button
          aria-label={`Afficher un indice, ${Math.max(0, hintLimit - hintsUsed)} restant${hintLimit - hintsUsed === 1 ? "" : "s"}`}
          disabled={
            !active ||
            !judge.hint ||
            !mistakesLoaded ||
            done ||
            hintLimit === 0 ||
            hintsUsed >= hintLimit ||
            mistakes >= 3 ||
            !unsolved
          }
          onClick={() => void requestHint()}
        >
          <Lightbulb />
          Indice ({Math.max(0, hintLimit - hintsUsed)})
        </button>
        {replayable && (
          <button
            className="abandon-grid"
            aria-label="Abandonner cette grille et en lancer une nouvelle"
            onClick={newGame}
          >
            <X aria-hidden="true" />
            Abandonner et relancer
          </button>
        )}
      </div>
      {hint && (
        <div className="hint-panel" role="status" aria-live="polite">
          <Lightbulb />
          <div>
            <b>{hintText(hint.index, hint.step).title}</b>
            <p>{hintText(hint.index, hint.step).text}</p>
            <div className="hint-actions">
              <button onClick={revealHint}>Révéler le chiffre</button>
              <button className="hint-dismiss" onClick={() => setShownHint(null)}>
                J’ai compris
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="game-footer">
        <span>
          3 vies par grille ·{" "}
          {hintLimit
            ? `${hintLimit - hintsUsed} indice${hintLimit - hintsUsed === 1 ? "" : "s"} restant${hintLimit - hintsUsed === 1 ? "" : "s"}`
            : "Aides désactivées"}
        </span>
        <span>
          Progression <b>{Math.round(((filled - givens) / (81 - givens)) * 100)}%</b>
        </span>
        <span className="fair">
          <ShieldCheck />
          {competitive ? "Mode compétitif" : "Solution unique vérifiée"}
        </span>
      </div>
      {mistakes > 0 && mistakes < 3 && (
        <p className="grid-invalid" role="status">
          Chiffre incorrect. {3 - mistakes} {3 - mistakes === 1 ? "vie restante" : "vies restantes"}
          .
        </p>
      )}
      {unverified.length > 0 && (
        <p className="grid-invalid" role="alert">
          {unverified.length === 1
            ? "Impossible de vérifier ce chiffre."
            : `Impossible de vérifier ${unverified.length} chiffres.`}{" "}
          <button className="retry-mistake" onClick={retryFailed}>
            Réessayer
          </button>
        </p>
      )}
      {mistakes >= 3 && (
        <div className="loss-result" role="status">
          <X />
          <h3>Grille perdue</h3>
          <p>Tu as utilisé tes trois vies. Cette grille ne peut plus être terminée.</p>
          {replayable && <button onClick={onNewGame}>Nouvelle grille</button>}
        </div>
      )}
      {done && (
        <div className={`victory${typeof experience === "number" ? " reward-ready" : ""}`}>
          <Trophy />
          <h3>{soloExperience && experience === "saving" ? "Grille terminée !" : "Victoire !"}</h3>
          <p>Grille {difficulty} terminée</p>
          <dl className="victory-stats">
            <div>
              <dt>Temps</dt>
              <dd>{time}</dd>
            </div>
            <div>
              <dt>Erreurs</dt>
              <dd>{mistakes}/3</dd>
            </div>
            <div>
              <dt>Indices</dt>
              <dd>{hintsUsed}</dd>
            </div>
          </dl>
          {record && (
            <span className={`victory-record ${record.best ? "best" : ""}`}>
              {record.best && <Trophy />}
              {record.label}
            </span>
          )}
          {soloExperience && (
            <div className="solo-xp" role="status" aria-live="polite">
              {typeof experience === "number" ? (
                <>
                  <span className="solo-xp-burst" aria-hidden="true">
                    ✦
                  </span>
                  <strong key={experience}>+{experience} XP</strong>
                  <small>Expérience ajoutée à ton compte</small>
                </>
              ) : experience === "saving" ? (
                <small>Enregistrement de ton expérience…</small>
              ) : experience === "guest" ? (
                <>
                  <small>Connecte-toi pour gagner de l’XP sur les prochaines grilles.</small>
                  {onConnect && (
                    <button className="solo-xp-connect" onClick={onConnect}>
                      Se connecter
                    </button>
                  )}
                </>
              ) : experience === "error" ? (
                <small>Résultat non enregistré : aucun XP ajouté.</small>
              ) : null}
            </div>
          )}
          <div className="victory-actions">
            <button className="victory-share" onClick={() => void share()}>
              <Share2 />
              {shared ? "Copié !" : "Partager"}
            </button>
            {replayable ? (
              <button onClick={onNewGame} disabled={soloExperience && experience === "saving"}>
                Nouvelle grille
              </button>
            ) : (
              <small>Enregistrement du temps…</small>
            )}
          </div>
        </div>
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
