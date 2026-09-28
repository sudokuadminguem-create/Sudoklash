"use client";
import { useEffect, useRef, useState } from "react";
import {
  Eraser,
  Flame,
  Heart,
  Lightbulb,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import { formatClock } from "@/app/lib/format-time";
import type { Entry, Judge } from "@/app/lib/judge";
import type { Difficulty } from "@/lib/difficulties";

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
}: SudokuBoardProps) {
  const replayable = !!onNewGame;
  const [cells, setCells] = useState([...puzzle]),
    [selected, setSelected] = useState<number | null>(null),
    [noteMode, setNoteMode] = useState(false),
    [cellNotes, setCellNotes] = useState<Record<number, number[]>>({}),
    [seconds, setSeconds] = useState(initialSeconds),
    [done, setDone] = useState(false),
    [experience, setExperience] = useState<ExperienceState>(null),
    [history, setHistory] = useState<{ cells: number[]; notes: Record<number, number[]> }[]>([]),
    [mistakes, setMistakes] = useState(initialMistakes),
    [hintsUsed, setHintsUsed] = useState(0),
    // Digits whose check failed. Checks never block the board: verdicts land when they come back.
    [failedEntries, setFailedEntries] = useState<Entry[]>([]),
    [mistakesLoaded, setMistakesLoaded] = useState(!storageKey);
  // Digits the judge accepted or rejected, by cell. A cell shows as correct or wrong only
  // while it still holds that digit, so erasing and undoing stay consistent.
  const [verdicts, setVerdicts] = useState<{
    correct: Record<number, number>;
    wrong: Record<number, number>;
  }>({ correct: {}, wrong: {} });
  const verdictsRef = useRef(verdicts);
  // Latest grid, for verdicts that come back after other digits were placed.
  const cellsRef = useRef(cells);
  const updateCells = (grid: number[]) => {
    cellsRef.current = grid;
    setCells(grid);
  };
  const isCorrect = (grid: number[], i: number) =>
    !!puzzle[i] || (!!grid[i] && verdictsRef.current.correct[i] === grid[i]);
  const isWrong = (i: number) => !!cells[i] && verdicts.wrong[i] === cells[i];
  const recordVerdict = (entry: Entry, correct: boolean) => {
    const key = correct ? "correct" : "wrong";
    const next = {
      ...verdictsRef.current,
      [key]: { ...verdictsRef.current[key], [entry.index]: entry.number },
    };
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
    try {
      const verdict = await judge.check(entry, grid);
      recordVerdict(entry, verdict.correct);
      if (verdict.correct) {
        // Other digits may have been placed since: count against the board as it is now.
        const current = cellsRef.current;
        const correctCells = current.filter((_, i) => isCorrect(current, i)).length;
        onProgress?.(correctCells, current);
        if (correctCells === 81) finish(current);
        return;
      }
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
  const retryFailed = () => {
    setFailedEntries([]);
    for (const entry of unverified) void submit(entry, cells);
  };
  const input = (n: number, index = selected, forceValue = false) => {
    if (
      !mistakesLoaded ||
      !active ||
      index === null ||
      puzzle[index] ||
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
    updateCells(c);
    setCellNotes((prev) => ({ ...prev, [index]: [] }));
    void submit({ index, number: n, id: crypto.randomUUID() }, c);
  };
  const erase = () => {
    if (selected === null || puzzle[selected] || mistakes >= 3) return;
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
    updateCells(last.cells);
    setCellNotes(last.notes);
    setHistory((h) => h.slice(0, -1));
  };
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
    selected !== null &&
    (i % 9 === selected % 9 ||
      Math.floor(i / 9) === Math.floor(selected / 9) ||
      (Math.floor(i / 27) === Math.floor(selected / 27) &&
        Math.floor((i % 9) / 3) === Math.floor((selected % 9) / 3)));
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
    const hint = await judge.hint(cells).catch(() => null);
    if (!hint) return;
    setHintsUsed(hintsUsed + 1);
    if (storageKey) window.localStorage.setItem(`${storageKey}:hints`, String(hintsUsed + 1));
    setSelected(hint.index);
    input(hint.number, hint.index, true);
  };
  return (
    <div className={`game-card ${!active ? "weekly-gated" : ""} ${mistakes >= 3 ? "lost" : ""}`}>
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
          <div className="timer">
            <Timer />
            {time}
          </div>
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
                sameValue = selectedValue > 0 && v === selectedValue,
                wrong = isWrong(i),
                failed = !!v && unverified.some((e) => e.index === i && e.number === v);
              return (
                <button
                  key={i}
                  role="gridcell"
                  aria-rowindex={row + 1}
                  aria-colindex={col + 1}
                  aria-selected={selected === i}
                  aria-label={`Case ligne ${row + 1}, colonne ${col + 1}${v ? `, chiffre ${v}${wrong ? ", incorrect" : ""}` : ", vide"}`}
                  disabled={mistakes >= 3}
                  onClick={() => active && setSelected(i)}
                  className={`${puzzle[i] ? "given" : "entered"} ${selected === i ? "sel" : ""} ${related(i) ? "line" : ""} ${sameValue ? "same" : ""} ${wrong ? "wrong" : ""} ${failed ? "unverified" : ""}`}
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
            aria-label={`Placer le chiffre ${n}`}
            aria-pressed={selectedValue === n}
            disabled={mistakes >= 3}
            className={selectedValue === n ? "active-number" : ""}
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
          <button aria-label="Nouvelle grille" onClick={onNewGame}>
            <RotateCcw />
            Nouvelle grille
          </button>
        )}
      </div>
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
          <p>
            Grille {difficulty} terminée en {time}
          </p>
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
          {replayable ? (
            <button onClick={onNewGame} disabled={soloExperience && experience === "saving"}>
              Nouvelle grille
            </button>
          ) : (
            <small>Enregistrement du temps…</small>
          )}
        </div>
      )}
    </div>
  );
}
