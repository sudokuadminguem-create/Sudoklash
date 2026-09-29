// Sudoku variants beyond the classic 9×9 grid. A variant is described by its geometry:
// the size, the shape of the boxes, whether both diagonals must hold every digit, and the
// cages of a killer grid (cells that must add up to a sum without repeating a digit).

export type Cage = { cells: number[]; sum: number };

export type Geometry = {
  size: number;
  boxRows: number;
  boxCols: number;
  diagonals: boolean;
  cages: Cage[];
};

export const CLASSIC: Geometry = { size: 9, boxRows: 3, boxCols: 3, diagonals: false, cages: [] };

export const variantIds = ["mini", "diagonal", "killer"] as const;
export type VariantId = (typeof variantIds)[number];

/**
 * What each variant is called on screen. The label doubles as the "difficulty" stored with a
 * result, so times and experience of a variant never mix with the classic levels.
 */
export const variantInfo: Record<
  VariantId,
  {
    label: string;
    tagline: string;
    xp: number;
    size: number;
    boxRows: number;
    boxCols: number;
    diagonals: boolean;
    killer: boolean;
  }
> = {
  mini: {
    label: "Mini 6×6",
    tagline: "Grille 6×6, blocs de 2×3 : idéale pour débuter",
    xp: 25,
    size: 6,
    boxRows: 2,
    boxCols: 3,
    diagonals: false,
    killer: false,
  },
  diagonal: {
    label: "Diagonale",
    tagline: "Les deux diagonales contiennent aussi chaque chiffre",
    xp: 70,
    size: 9,
    boxRows: 3,
    boxCols: 3,
    diagonals: true,
    killer: false,
  },
  killer: {
    label: "Killer",
    tagline: "Des cages dont la somme est donnée, sans chiffre répété",
    xp: 100,
    size: 9,
    boxRows: 3,
    boxCols: 3,
    diagonals: false,
    killer: true,
  },
};

export const isVariantId = (value: unknown): value is VariantId =>
  (variantIds as readonly unknown[]).includes(value);

export const variantByLabel = (label: unknown) =>
  variantIds.find((id) => variantInfo[id].label === label);

export function geometryOf(id: VariantId | undefined, cages: Cage[] = []): Geometry {
  if (!id) return CLASSIC;
  const { size, boxRows, boxCols, diagonals } = variantInfo[id];
  return { size, boxRows, boxCols, diagonals, cages };
}

export const cellCount = (g: Geometry) => g.size * g.size;

/** Side of the grid (6 or 9) that has this many cells, or null when none does. */
export function sizeOfCells(cells: number | undefined) {
  if (!Number.isInteger(cells)) return null;
  const size = Math.round(Math.sqrt(cells as number));
  return size * size === cells && (size === 6 || size === 9) ? size : null;
}

/** Cells of the main and anti-diagonals. */
export function diagonalCells(size: number) {
  return [
    Array.from({ length: size }, (_, i) => i * size + i),
    Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)),
  ];
}

/** Rows, columns and boxes of a grid: the zones that hold each digit once. */
export function baseUnits(g: Geometry) {
  const { size, boxRows, boxCols } = g;
  const rows = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => r * size + c),
  );
  const columns = Array.from({ length: size }, (_, c) =>
    Array.from({ length: size }, (_, r) => r * size + c),
  );
  const boxes: number[][] = [];
  for (let br = 0; br < size; br += boxRows)
    for (let bc = 0; bc < size; bc += boxCols) {
      const cells: number[] = [];
      for (let r = 0; r < boxRows; r++)
        for (let c = 0; c < boxCols; c++) cells.push((br + r) * size + bc + c);
      boxes.push(cells);
    }
  return [...rows, ...columns, ...boxes];
}

/** Every zone in which a digit may appear only once. */
export function distinctUnits(g: Geometry) {
  return [
    ...baseUnits(g),
    ...(g.diagonals ? diagonalCells(g.size) : []),
    ...g.cages.map((cage) => cage.cells),
  ];
}

/** For each cell, the other cells that cannot hold the same digit. */
export function peerTable(g: Geometry) {
  const peers = Array.from({ length: cellCount(g) }, () => new Set<number>());
  for (const unit of distinctUnits(g))
    for (const a of unit) for (const b of unit) if (a !== b) peers[a].add(b);
  return peers.map((set) => [...set]);
}

const peerSets = new WeakMap<Geometry, Set<number>[]>();

/** Whether two cells share a row, column, box, diagonal (when it counts) or cage. */
export function areRelated(g: Geometry, a: number, b: number) {
  if (a === b) return true;
  if (!g.diagonals && g.cages.length === 0) {
    const { size, boxRows, boxCols } = g;
    const [ra, ca, rb, cb] = [Math.floor(a / size), a % size, Math.floor(b / size), b % size];
    return (
      ra === rb ||
      ca === cb ||
      (Math.floor(ra / boxRows) === Math.floor(rb / boxRows) &&
        Math.floor(ca / boxCols) === Math.floor(cb / boxCols))
    );
  }
  // Worked out once per geometry: the board asks this for every cell after every move.
  let sets = peerSets.get(g);
  if (!sets) {
    sets = peerTable(g).map((cells) => new Set(cells));
    peerSets.set(g, sets);
  }
  return sets[a].has(b);
}

/** Parses and checks the cages a client sends or the bank stores. */
export function validCages(cages: unknown, size: number): cages is Cage[] {
  if (!Array.isArray(cages)) return false;
  const seen = new Set<number>();
  return cages.every((cage) => {
    if (!cage || !Array.isArray(cage.cells) || !Number.isInteger(cage.sum)) return false;
    if (cage.cells.length < 1 || cage.cells.length > size) return false;
    return cage.cells.every((cell: unknown) => {
      if (!Number.isInteger(cell) || (cell as number) < 0 || (cell as number) >= size * size)
        return false;
      if (seen.has(cell as number)) return false;
      seen.add(cell as number);
      return true;
    });
  });
}

/** Compact text form of cages, for the bank and the database: "0,1,9:14;2,3:7". */
export const cagesToText = (cages: Cage[]) =>
  cages.map((cage) => `${cage.cells.join(",")}:${cage.sum}`).join(";");

export function cagesFromText(text: string): Cage[] {
  if (!text) return [];
  return text.split(";").map((part) => {
    const [cells, sum] = part.split(":");
    return { cells: cells.split(",").map(Number), sum: Number(sum) };
  });
}
