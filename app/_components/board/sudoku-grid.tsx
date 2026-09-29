import type { CSSProperties } from "react";
import type { Notes } from "@/app/lib/board-logic";

type SudokuGridProps = {
  cells: readonly number[];
  puzzle: readonly number[];
  notes: Notes;
  difficulty: string;
  selected: number | null;
  /** Digit of the selected cell, 0 when empty. */
  selectedValue: number;
  highlightSame: boolean;
  /** Freezes the cells once the game is lost. */
  lost: boolean;
  /** Plays the victory wave. */
  won: boolean;
  hintTarget: number | undefined;
  hintCells: ReadonlySet<number>;
  isWrong: (index: number) => boolean;
  isLocked: (index: number) => boolean;
  isUnverified: (index: number) => boolean;
  isRelated: (index: number) => boolean;
  onSelect: (index: number) => void;
};

/** The 9×9 grid: givens, entered digits, notes and the state of each cell. */
export function SudokuGrid(props: SudokuGridProps) {
  const { cells, puzzle, notes, selected, selectedValue } = props;
  return (
    <div
      className="sudoku"
      role="grid"
      aria-label={`Grille de Sudoku 9 par 9, niveau ${props.difficulty}`}
    >
      {Array.from({ length: 9 }, (_, row) => (
        <div
          key={row}
          role="row"
          className={`sudoku-row ${row === 2 || row === 5 ? "block-bottom" : ""}`}
        >
          {cells.slice(row * 9, row * 9 + 9).map((v, col) => {
            const i = row * 9 + col,
              sameValue = props.highlightSame && selectedValue > 0 && v === selectedValue,
              wrong = props.isWrong(i),
              locked = props.isLocked(i),
              failed = !!v && props.isUnverified(i);
            return (
              <button
                key={i}
                role="gridcell"
                aria-rowindex={row + 1}
                aria-colindex={col + 1}
                aria-selected={selected === i}
                aria-readonly={!!puzzle[i] || locked}
                aria-invalid={wrong || undefined}
                aria-label={`Case ligne ${row + 1}, colonne ${col + 1}${v ? `, chiffre ${v}${locked ? ", validé et verrouillé" : ""}` : wrong ? ", erreur, case vide" : `, vide${notes[i]?.length ? `, notes ${notes[i].join(", ")}` : ""}`}`}
                disabled={props.lost}
                onClick={() => props.onSelect(i)}
                className={`${puzzle[i] ? "given" : "entered"} ${selected === i ? "sel" : ""} ${props.isRelated(i) ? "line" : ""} ${sameValue ? "same" : ""} ${wrong ? "wrong" : ""} ${locked ? "confirmed" : ""} ${failed ? "unverified" : ""} ${props.hintTarget === i ? "hint-target" : props.hintCells.has(i) ? "hint-unit" : ""}`}
                style={props.won ? ({ "--wave": row + col } as CSSProperties) : undefined}
              >
                {v ||
                  (notes[i]?.length ? (
                    <span className="cell-notes">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                        <i key={n}>{notes[i].includes(n) ? n : ""}</i>
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
  );
}
