"use client";
import { useEffect, useMemo, useState } from "react";
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
import { nextSudokuVariant } from "@/app/lib/sudoku-variants";
import type { Difficulty } from "@/lib/difficulties";
import { solveGrid } from "@/lib/sudoku-solver";

// Solo grids; each game shows a shuffled variant with the same clues and difficulty.
const rawPuzzles: Record<Difficulty, string> = {
  Débutant: "534678912672195348198342567859761423426853791713924856961537284287419635345286000",
  Facile: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  Intermédiaire:
    "000260701680070090190004500820100040004602900050003028009300074040050036703018000",
  Difficile: "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
  Expert: "005300000800000020070010500400005300010070006003200080060500009004000030000009700",
  Maître: "100007090030020008009600500005300900010080002600004000300000010040000007007000300",
};
const toGrid = (s: string) => s.split("").map(Number);
const puzzles = Object.fromEntries(
  Object.entries(rawPuzzles).map(([difficulty, value]) => {
    const puzzle = toGrid(value),
      solution = solveGrid(puzzle);
    if (!solution) throw new Error(`Grille invalide: ${difficulty}`);
    return [difficulty, { puzzle, solution, id: `${difficulty.toLowerCase()}-01` }];
  }),
) as Record<Difficulty, { puzzle: number[]; solution: number[]; id: string }>;

/** What a solo win reports back: the XP earned, or null when nothing was saved. */
type SolveResult = { xpGained: number } | null;
/** XP shown after a solo win, or where saving it stands. */
type ExperienceState = number | "saving" | "guest" | "error" | null;

type SudokuBoardProps = {
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
  onMistake?: (index: number, number: number, id: string, grid: number[]) => Promise<number>;
  onProgress?: (filled: number, grid: number[]) => void;
  replayable?: boolean;
  onReady?: () => void;
  readyBusy?: boolean;
  puzzleOverride?: number[];
  challengeLabel?: string;
  race?: { meName: string; opponentName: string; opponentProgress: number; totalToFill?: number };
  storageKey?: string;
  hintsAllowed?: number;
  soloExperience?: boolean;
  onConnect?: () => void;
};

export function SudokuBoard({
  difficulty = "Intermédiaire",
  competitive = false,
  title = "Arène éclair",
  active = true,
  initialSeconds = 0,
  initialMistakes = 0,
  onSolved,
  onMistake,
  onProgress,
  replayable = true,
  onReady,
  readyBusy = false,
  puzzleOverride,
  challengeLabel = "GRILLE HEBDOMADAIRE",
  race,
  storageKey,
  hintsAllowed,
  soloExperience = false,
  onConnect,
}: SudokuBoardProps) {
  const game = puzzles[difficulty];
  const [variant, setVariant] = useState(() => ({ puzzle: game.puzzle, solution: game.solution }));
  const [ready, setReady] = useState(!!puzzleOverride);
  const puzzle = puzzleOverride ?? variant.puzzle;
  const overrideSolution = useMemo(
    () => (puzzleOverride ? solveGrid(puzzleOverride) : null),
    [puzzleOverride],
  );
  const solution = overrideSolution ?? variant.solution;
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
    [pendingMistake, setPendingMistake] = useState<{
      index: number;
      number: number;
      id: string;
    } | null>(null),
    [mistakeError, setMistakeError] = useState(false),
    [mistakeLoaded, setMistakeLoaded] = useState(!storageKey);
  const hintLimit = hintsAllowed ?? (race ? 1 : competitive ? 0 : 3);
  useEffect(() => {
    if (puzzleOverride) return;
    const first = nextSudokuVariant(game.puzzle, game.solution, game.puzzle);
    setVariant(first);
    setCells([...first.puzzle]);
    setReady(true);
  }, [difficulty, puzzleOverride, game]);
  useEffect(() => {
    if (!storageKey) return;
    const saved = Number(window.localStorage.getItem(storageKey));
    const savedHints = Number(window.localStorage.getItem(`${storageKey}:hints`));
    setMistakes(Number.isInteger(saved) ? Math.max(0, Math.min(3, saved)) : 0);
    setHintsUsed(Number.isInteger(savedHints) ? Math.max(0, Math.min(1, savedHints)) : 0);
    setMistakeLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (done || !active || !ready || mistakes >= 3) return;
    const t = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [done, active, ready, mistakes]);
  const confirmMistake = async (
    value: { index: number; number: number; id: string },
    grid = cells,
  ) => {
    if (!onMistake) return;
    setMistakeError(false);
    try {
      const count = await onMistake(value.index, value.number, value.id, grid);
      setMistakes(count);
      setPendingMistake(null);
    } catch {
      setMistakeError(true);
    }
  };
  const input = (n: number, index = selected, forceValue = false) => {
    if (
      !ready ||
      !mistakeLoaded ||
      !active ||
      index === null ||
      puzzle[index] ||
      done ||
      mistakes >= 3 ||
      pendingMistake ||
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
    setCells(c);
    setCellNotes((prev) => ({ ...prev, [index]: [] }));
    onProgress?.(c.filter((value, i) => value === solution[i]).length, c);
    if (n !== solution[index]) {
      const count = mistakes + 1;
      setMistakes(count);
      if (storageKey) window.localStorage.setItem(storageKey, String(count));
      if (onMistake) {
        const value = { index, number: n, id: crypto.randomUUID() };
        setPendingMistake(value);
        void confirmMistake(value, c);
      }
      return;
    }
    if (c.every((v, i) => v === solution[i])) {
      setDone(true);
      if (soloExperience) {
        setExperience("saving");
        void Promise.resolve()
          .then(() => onSolved?.(c, Math.max(1, seconds), puzzle))
          .then((result) =>
            setExperience(result && typeof result === "object" ? result.xpGained : "guest"),
          )
          .catch(() => setExperience("error"));
      } else onSolved?.(c, Math.max(1, seconds), puzzle);
    }
  };
  const erase = () => {
    if (selected === null || puzzle[selected] || mistakes >= 3 || pendingMistake) return;
    setHistory((h) => [...h, { cells: [...cells], notes: { ...cellNotes } }]);
    const c = [...cells];
    c[selected] = 0;
    setCells(c);
    setCellNotes((p) => ({ ...p, [selected]: [] }));
  };
  const undo = () => {
    if (mistakes >= 3 || pendingMistake) return;
    const last = history.at(-1);
    if (!last) return;
    setCells(last.cells);
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
      ? cells.filter((v, i) => !puzzle[i] && v === solution[i]).length
      : filled,
    raceTotal = race?.totalToFill ?? 81,
    time = formatClock(seconds),
    selectedValue = selected === null ? 0 : cells[selected];
  const related = (i: number) =>
    selected !== null &&
    (i % 9 === selected % 9 ||
      Math.floor(i / 9) === Math.floor(selected / 9) ||
      (Math.floor(i / 27) === Math.floor(selected / 27) &&
        Math.floor((i % 9) / 3) === Math.floor((selected % 9) / 3)));
  const useHint = () => {
    if (
      !ready ||
      !mistakeLoaded ||
      !active ||
      done ||
      mistakes >= 3 ||
      pendingMistake ||
      hintsUsed >= hintLimit
    )
      return;
    const i = cells.findIndex((v, j) => !puzzle[j] && v !== solution[j]);
    if (i < 0) return;
    setHintsUsed(hintsUsed + 1);
    if (storageKey) window.localStorage.setItem(`${storageKey}:hints`, String(hintsUsed + 1));
    setSelected(i);
    input(solution[i], i, true);
  };
  const newGame = () => {
    const next = nextSudokuVariant(game.puzzle, game.solution, puzzle);
    setVariant(next);
    setCells([...next.puzzle]);
    setSelected(null);
    setNoteMode(false);
    setCellNotes({});
    setMistakes(0);
    setHintsUsed(0);
    setSeconds(0);
    setDone(false);
    setExperience(null);
    setHistory([]);
  };
  if (!ready)
    return (
      <div className="game-card" role="status">
        Préparation d’une nouvelle grille {difficulty}…
      </div>
    );
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
            · {difficulty.toUpperCase()} ·{" "}
            {variant.puzzle === game.puzzle ? game.id : "nouvelle grille"}
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
                wrong = !!v && !puzzle[i] && v !== solution[i];
              return (
                <button
                  key={i}
                  role="gridcell"
                  aria-rowindex={row + 1}
                  aria-colindex={col + 1}
                  aria-selected={selected === i}
                  aria-label={`Case ligne ${row + 1}, colonne ${col + 1}${v ? `, chiffre ${v}${wrong ? ", incorrect" : ""}` : ", vide"}`}
                  disabled={mistakes >= 3 || !!pendingMistake}
                  onClick={() => active && setSelected(i)}
                  className={`${puzzle[i] ? "given" : "entered"} ${selected === i ? "sel" : ""} ${related(i) ? "line" : ""} ${sameValue ? "same" : ""} ${wrong ? "wrong" : ""}`}
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
            disabled={mistakes >= 3 || !!pendingMistake}
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
          disabled={competitive || mistakes >= 3 || !!pendingMistake}
          onClick={() => setNoteMode(!noteMode)}
          className={noteMode ? "active" : ""}
        >
          <Pencil />
          Notes <small>N</small>
        </button>
        <button
          aria-label="Effacer la case sélectionnée"
          disabled={mistakes >= 3 || !!pendingMistake}
          onClick={erase}
        >
          <Eraser />
          Effacer
        </button>
        <button
          aria-label="Annuler la dernière action"
          onClick={undo}
          disabled={!history.length || mistakes >= 3 || !!pendingMistake}
        >
          <RotateCcw />
          Annuler
        </button>
        <button
          aria-label={`Afficher un indice, ${Math.max(0, hintLimit - hintsUsed)} restant${hintLimit - hintsUsed === 1 ? "" : "s"}`}
          disabled={
            !active ||
            !mistakeLoaded ||
            done ||
            hintLimit === 0 ||
            hintsUsed >= hintLimit ||
            mistakes >= 3 ||
            !!pendingMistake ||
            !cells.some((v, i) => !puzzle[i] && v !== solution[i])
          }
          onClick={useHint}
        >
          <Lightbulb />
          Indice ({Math.max(0, hintLimit - hintsUsed)})
        </button>
        {replayable && (
          <button aria-label="Nouvelle grille" onClick={newGame}>
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
      {mistakeError && pendingMistake && (
        <p className="grid-invalid" role="alert">
          Impossible d’enregistrer l’erreur.{" "}
          <button className="retry-mistake" onClick={() => void confirmMistake(pendingMistake)}>
            Réessayer
          </button>
        </p>
      )}
      {mistakes >= 3 && (
        <div className="loss-result" role="status">
          <X />
          <h3>Grille perdue</h3>
          <p>Tu as utilisé tes trois vies. Cette grille ne peut plus être terminée.</p>
          {replayable && <button onClick={newGame}>Nouvelle grille</button>}
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
            <button onClick={newGame} disabled={soloExperience && experience === "saving"}>
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
