type Variant = { puzzle: number[]; solution: number[] };

const UINT32_RANGE = 2 ** 32;

// Uniform integer in [0, max) from the Web Crypto CSPRNG, using rejection
// sampling to avoid modulo bias.
function randomInt(max: number) {
  const limit = UINT32_RANGE - (UINT32_RANGE % max);
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function shuffle(values: number[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
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
  const transpose = randomInt(2) === 1;
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
