import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { digitsFor, type Notes } from "@/app/lib/board-logic";
import { useI18n } from "@/app/lib/i18n";
import { levelName } from "@/app/lib/i18n-core";
import { CLASSIC, diagonalCells, type Geometry } from "@/lib/variants";

type SudokuGridProps = {
  /** Size, boxes, diagonals and cages of the grid; the classic 9×9 when left out. */
  geometry?: Geometry;
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
  /** Cells of the technique a hint teaches (a pair, an X-Wing…). */
  patternCells: ReadonlySet<number>;
  isWrong: (index: number) => boolean;
  isLocked: (index: number) => boolean;
  isUnverified: (index: number) => boolean;
  isRelated: (index: number) => boolean;
  onSelect: (index: number) => void;
  /** Changes each time the selection moved by keyboard: the selected cell then takes the focus. */
  focusToken?: number;
};

/** Where each cage's outline goes, and which cell carries its sum. */
function cageLayout(geometry: Geometry) {
  const { size, cages } = geometry;
  const owner = new Map<number, number>();
  cages.forEach((cage, k) => cage.cells.forEach((cell) => owner.set(cell, k)));
  const layout = new Map<number, { edges: string; sum?: number; total: number }>();
  cages.forEach((cage, k) => {
    const first = Math.min(...cage.cells);
    for (const cell of cage.cells) {
      const [r, c] = [Math.floor(cell / size), cell % size];
      // A side is outlined unless the neighbour on that side is in the same cage.
      const outlined = (neighbour: number, exists: boolean) =>
        !exists || owner.get(neighbour) !== k;
      const edges =
        (outlined(cell - size, r > 0) ? "t" : "") +
        (outlined(cell + 1, c < size - 1) ? "r" : "") +
        (outlined(cell + size, r < size - 1) ? "b" : "") +
        (outlined(cell - 1, c > 0) ? "l" : "");
      layout.set(cell, { edges, sum: cell === first ? cage.sum : undefined, total: cage.sum });
    }
  });
  return layout;
}

/** The grid: givens, entered digits, notes and the state of each cell. */
export function SudokuGrid(props: SudokuGridProps) {
  const { cells, puzzle, notes, selected, selectedValue } = props;
  const { t } = useI18n();
  const geometry = props.geometry ?? CLASSIC;
  const { size, boxRows } = geometry;
  const cages = useMemo(() => cageLayout(geometry), [geometry]);
  const diagonals = useMemo(
    () => new Set(geometry.diagonals ? diagonalCells(size).flat() : []),
    [geometry, size],
  );
  const noteDigits = digitsFor(size);
  const gridRef = useRef<HTMLDivElement>(null);
  // One tab stop for the whole grid: the selected cell, or the first one before any selection.
  // The arrow keys do the rest, and move the focus along with the selection.
  useEffect(() => {
    if (!props.focusToken || selected === null) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-cell="${selected}"]`)?.focus();
    // Only a keyboard move should steal the focus, not every change of selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusToken]);
  return (
    <div
      className="sudoku"
      ref={gridRef}
      role="grid"
      aria-rowcount={size}
      aria-colcount={size}
      aria-label={t("board.grid", { size, level: levelName(t, props.difficulty) })}
    >
      {Array.from({ length: size }, (_, row) => (
        <div
          key={row}
          role="row"
          className={`sudoku-row ${row < size - 1 && (row + 1) % boxRows === 0 ? "block-bottom" : ""}`}
          style={
            size === 9 ? undefined : { gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }
          }
        >
          {cells.slice(row * size, row * size + size).map((v, col) => {
            const i = row * size + col,
              cage = cages.get(i),
              sameValue = props.highlightSame && selectedValue > 0 && v === selectedValue,
              wrong = props.isWrong(i),
              locked = props.isLocked(i),
              failed = !!v && props.isUnverified(i);
            return (
              <button
                key={i}
                role="gridcell"
                data-cell={i}
                tabIndex={selected === i || (selected === null && i === 0) ? 0 : -1}
                onFocus={() => selected !== i && props.onSelect(i)}
                aria-rowindex={row + 1}
                aria-colindex={col + 1}
                aria-selected={selected === i}
                aria-readonly={!!puzzle[i] || locked}
                aria-invalid={wrong || undefined}
                aria-label={
                  t("cell.base", { row: row + 1, col: col + 1 }) +
                  (puzzle[i] ? t("cell.given") : "") +
                  (v
                    ? t("cell.value", { n: v }) + (locked ? t("cell.locked") : "")
                    : wrong
                      ? t("cell.wrongEmpty")
                      : t("cell.empty") +
                        (notes[i]?.length ? t("cell.notes", { list: notes[i].join(", ") }) : "")) +
                  (diagonals.has(i) ? t("cell.diagonal") : "") +
                  (cage ? t("cell.cage", { total: cage.total }) : "")
                }
                disabled={props.lost}
                onClick={() => props.onSelect(i)}
                className={`${puzzle[i] ? "given" : "entered"} ${selected === i ? "sel" : ""} ${props.isRelated(i) ? "line" : ""} ${sameValue ? "same" : ""} ${wrong ? "wrong" : ""} ${locked ? "confirmed" : ""} ${failed ? "unverified" : ""} ${diagonals.has(i) ? "diag" : ""} ${cage ? `cage ${[...cage.edges].map((e) => `cage-${e}`).join(" ")}` : ""} ${props.hintTarget === i ? "hint-target" : props.patternCells.has(i) ? "hint-pattern" : props.hintCells.has(i) ? "hint-unit" : ""}`}
                style={props.won ? ({ "--wave": row + col } as CSSProperties) : undefined}
              >
                {cage?.sum !== undefined && <span className="cage-sum">{cage.sum}</span>}
                {v ||
                  (notes[i]?.length ? (
                    <span className="cell-notes">
                      {noteDigits.map((n) => (
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
