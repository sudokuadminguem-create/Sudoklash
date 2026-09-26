type Variant = { puzzle: number[]; solution: number[] };

function shuffle(values: number[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function orderedLines() {
  return shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((line) => group * 3 + line));
}

// Sudoku symmetry preserves the clues, uniqueness and solving difficulty.
export function makeSudokuVariant(puzzle: number[], solution: number[]): Variant {
  const rows = orderedLines();
  const columns = orderedLines();
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const transpose = Math.random() < 0.5;
  const transform = (grid: number[]) =>
    Array.from({ length: 81 }, (_, index) => {
      const row = Math.floor(index / 9);
      const column = index % 9;
      const original = transpose
        ? grid[rows[column] * 9 + columns[row]]
        : grid[rows[row] * 9 + columns[column]];
      return original ? digits[original - 1] : 0;
    });
  return { puzzle: transform(puzzle), solution: transform(solution) };
}
