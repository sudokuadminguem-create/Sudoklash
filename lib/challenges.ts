import { env } from "cloudflare:workers";
import {periodPuzzle} from "./challenge-schedule";

export type ChallengeKind = "daily" | "weekly";

export const challengeDefaults: Record<ChallengeKind, { title: string; puzzle: string }> = {
  daily: {
    title: "Le Sprint du jour",
    puzzle: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  },
  weekly: {
    title: "La Spirale",
    puzzle: "000000907000420180000705026100904000050000040000507009920108000034059000507000000",
  },
};

export async function getChallengeConfig(kind: ChallengeKind) {
  const stored = await env.DB.prepare(
    "SELECT title, puzzle FROM challenge_settings WHERE challenge_type = ?",
  ).bind(kind).first<{ title: string; puzzle: string }>();
  return stored ?? challengeDefaults[kind];
}

export async function getPeriodChallenge(kind:ChallengeKind,periodId:string){
 const config=await getChallengeConfig(kind);
 return {...config,puzzle:periodPuzzle(config.puzzle,kind,periodId)};
}

export function solvePuzzle(value: string) {
  if (!/^[0-9]{81}$/.test(value)) return null;
  const grid = value.split("").map(Number);
  const valid = (position: number, number: number) => {
    const row = Math.floor(position / 9), column = position % 9;
    for (let index = 0; index < 9; index++) {
      if (grid[row * 9 + index] === number || grid[index * 9 + column] === number) return false;
    }
    const blockRow = Math.floor(row / 3) * 3, blockColumn = Math.floor(column / 3) * 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      if (grid[(blockRow + y) * 9 + blockColumn + x] === number) return false;
    }
    return true;
  };
  const solve = (): boolean => {
    let position = -1, options: number[] = [];
    for (let index = 0; index < 81; index++) if (!grid[index]) {
      const candidates = [];
      for (let number = 1; number <= 9; number++) if (valid(index, number)) candidates.push(number);
      if (!candidates.length) return false;
      if (position < 0 || candidates.length < options.length) {
        position = index;
        options = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (position < 0) return true;
    for (const number of options) {
      grid[position] = number;
      if (solve()) return true;
      grid[position] = 0;
    }
    return false;
  };
  return solve() ? grid : null;
}

export function hasUniqueSolution(value: string) {
  if (!/^[0-9]{81}$/.test(value)) return false;
  const grid = value.split("").map(Number);
  let solutions = 0;
  const valid = (position: number, number: number) => {
    const row = Math.floor(position / 9), column = position % 9;
    for (let index = 0; index < 9; index++) if (grid[row * 9 + index] === number || grid[index * 9 + column] === number) return false;
    const blockRow = Math.floor(row / 3) * 3, blockColumn = Math.floor(column / 3) * 3;
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (grid[(blockRow + y) * 9 + blockColumn + x] === number) return false;
    return true;
  };
  const search = () => {
    if (solutions > 1) return;
    let position = -1, options: number[] = [];
    for (let index = 0; index < 81; index++) if (!grid[index]) {
      const candidates = [];
      for (let number = 1; number <= 9; number++) if (valid(index, number)) candidates.push(number);
      if (!candidates.length) return;
      if (position < 0 || candidates.length < options.length) {
        position = index;
        options = candidates;
        if (candidates.length === 1) break;
      }
    }
    if (position < 0) { solutions++; return; }
    for (const number of options) {
      grid[position] = number;
      search();
      grid[position] = 0;
    }
  };
  search();
  return solutions === 1;
}
