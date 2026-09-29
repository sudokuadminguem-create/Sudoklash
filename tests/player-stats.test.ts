import { describe, expect, it } from "vitest";
import { dayKey, progressionFor, streakOf, trendOf } from "@/lib/player-stats";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-09-29T14:00:00Z"); // 16:00 in Paris

describe("dayKey", () => {
  it("uses the Paris calendar, not UTC", () => {
    expect(dayKey(at("2026-06-01T21:59:00Z"))).toBe("2026-06-01"); // 23:59 in Paris (summer)
    expect(dayKey(at("2026-06-01T22:00:00Z"))).toBe("2026-06-02"); // midnight in Paris
    expect(dayKey(at("2026-01-15T22:59:00Z"))).toBe("2026-01-15"); // winter is UTC+1
    expect(dayKey(at("2026-01-15T23:00:00Z"))).toBe("2026-01-16");
  });
});

describe("streakOf", () => {
  it("is empty without results", () => {
    expect(streakOf([], NOW)).toEqual({ current: 0, best: 0, playedToday: false });
  });

  it("counts consecutive days, several results in a day counting once", () => {
    const results = [
      at("2026-09-27T08:00:00Z"),
      at("2026-09-28T08:00:00Z"),
      at("2026-09-28T17:00:00Z"),
      at("2026-09-29T09:00:00Z"),
    ];
    expect(streakOf(results, NOW)).toEqual({ current: 3, best: 3, playedToday: true });
  });

  it("keeps the streak alive until the end of the next day", () => {
    const results = [at("2026-09-27T08:00:00Z"), at("2026-09-28T08:00:00Z")];
    expect(streakOf(results, NOW)).toEqual({ current: 2, best: 2, playedToday: false });
  });

  it("resets after a missed day but remembers the best run", () => {
    const results = [
      at("2026-09-01T08:00:00Z"),
      at("2026-09-02T08:00:00Z"),
      at("2026-09-03T08:00:00Z"),
      at("2026-09-04T08:00:00Z"),
      at("2026-09-27T08:00:00Z"),
    ];
    expect(streakOf(results, NOW)).toEqual({ current: 0, best: 4, playedToday: false });
  });

  it("starts again from one after a gap", () => {
    const results = [at("2026-09-20T08:00:00Z"), at("2026-09-29T08:00:00Z")];
    expect(streakOf(results, NOW)).toEqual({ current: 1, best: 1, playedToday: true });
  });

  it("does not depend on the order of the results", () => {
    const results = [
      at("2026-09-29T09:00:00Z"),
      at("2026-09-27T08:00:00Z"),
      at("2026-09-28T08:00:00Z"),
    ];
    expect(streakOf(results, NOW).current).toBe(3);
  });

  it("stays consecutive across the changes to and from summer time", () => {
    const spring = [
      at("2026-03-28T12:00:00Z"),
      at("2026-03-29T12:00:00Z"),
      at("2026-03-30T12:00:00Z"),
    ];
    expect(streakOf(spring, at("2026-03-30T18:00:00Z")).best).toBe(3);
    const autumn = [
      at("2026-10-24T12:00:00Z"),
      at("2026-10-25T12:00:00Z"),
      at("2026-10-26T12:00:00Z"),
    ];
    expect(streakOf(autumn, at("2026-10-26T18:00:00Z")).best).toBe(3);
  });

  it("counts a late-night result on the Paris day it belongs to", () => {
    // 23:30 UTC on the 27th is 01:30 on the 28th in Paris, so 27, 28 and 29 are consecutive
    // there, whereas the UTC days 27 and 29 alone would leave a gap.
    const results = [
      at("2026-09-27T10:00:00Z"),
      at("2026-09-27T23:30:00Z"),
      at("2026-09-29T10:00:00Z"),
    ];
    expect(streakOf(results, NOW)).toEqual({ current: 3, best: 3, playedToday: true });
  });
});

const result = (difficulty: string, seconds: number, day: number) => ({
  difficulty,
  elapsed_seconds: seconds,
  completed_at: at(`2026-09-${String(day).padStart(2, "0")}T10:00:00Z`),
});

describe("progressionFor", () => {
  it("keeps one difficulty, oldest first, and the latest results only", () => {
    const list = [
      result("Facile", 300, 5),
      result("Expert", 900, 4),
      result("Facile", 250, 3),
      result("Facile", 200, 7),
    ];
    expect(progressionFor(list, "Facile").map((r) => r.elapsed_seconds)).toEqual([250, 300, 200]);
    expect(progressionFor(list, "Facile", 2).map((r) => r.elapsed_seconds)).toEqual([300, 200]);
    expect(progressionFor(list, "Maître")).toEqual([]);
  });

  it("does not reorder the list it is given", () => {
    const list = [result("Facile", 300, 5), result("Facile", 250, 3)];
    progressionFor(list, "Facile");
    expect(list.map((r) => r.elapsed_seconds)).toEqual([300, 250]);
  });
});

describe("trendOf", () => {
  const times = (values: number[]) => values.map((elapsed_seconds) => ({ elapsed_seconds }));

  it("needs at least four results", () => {
    expect(trendOf(times([100, 90, 80]))).toBeNull();
  });

  it("is negative when the player got faster", () => {
    const trend = trendOf(times([400, 400, 200, 200]))!;
    expect(trend).toMatchObject({ before: 400, after: 200 });
    expect(trend.change).toBeCloseTo(-0.5);
  });

  it("is positive when the player got slower", () => {
    expect(trendOf(times([100, 100, 150, 150]))!.change).toBeCloseTo(0.5);
  });

  it("ignores the middle result of an odd count", () => {
    const trend = trendOf(times([300, 300, 9999, 150, 150]))!;
    expect(trend).toMatchObject({ before: 300, after: 150 });
  });
});
