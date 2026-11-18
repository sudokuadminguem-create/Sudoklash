export const delays = [5, 10, 20, 30, 60] as const;
export const tournamentDuration = 30 * 60_000;
export const tournamentMinimum = 5;
export const tournamentCapacity = 100;
export const hostFee = 50;
export const entryFee = 25;

export function tournamentPrizes(pot: number, count: number) {
  const n = Math.min(25, count);
  if (n === 0) return [];
  const remainder = pot - entryFee * n;
  const total = (n * (n + 1)) / 2;
  const payouts = Array.from(
    { length: n },
    (_, i) => entryFee + Math.floor((remainder * (n - i)) / total),
  );
  const left = pot - payouts.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left; i++) payouts[i]++;
  return payouts;
}
