// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PACK_SIZE, readPack, refillPack, takeOfflineGrid } from "@/app/lib/offline-pack";
import { soloDifficulties } from "@/lib/difficulties";

const grid = (seed: number) => ({
  puzzle: Array.from({ length: 81 }, (_, i) => (i + seed) % 10),
  solution: Array.from({ length: 81 }, (_, i) => ((i + seed) % 9) + 1),
});

beforeEach(() => window.localStorage.clear());

describe("offline pack", () => {
  it("stocks every difficulty with its spares", async () => {
    let n = 0;
    const fetchGrid = vi.fn(async () => grid(n++));
    await refillPack(fetchGrid);
    expect(fetchGrid).toHaveBeenCalledTimes(soloDifficulties.length * PACK_SIZE);
    for (const level of soloDifficulties) expect(readPack()[level]).toHaveLength(PACK_SIZE);
    // Already full: nothing more is asked.
    await refillPack(fetchGrid);
    expect(fetchGrid).toHaveBeenCalledTimes(soloDifficulties.length * PACK_SIZE);
  });

  it("hands out each spare grid once, then reports none left", async () => {
    await refillPack(async () => grid(1));
    expect(takeOfflineGrid("Facile")).toEqual(grid(1));
    expect(takeOfflineGrid("Facile")).toEqual(grid(1));
    expect(takeOfflineGrid("Facile")).toBeNull();
    expect(takeOfflineGrid("Expert")).not.toBeNull();
  });

  it("keeps what it got when the connection drops, and asks again later", async () => {
    let calls = 0;
    await refillPack(async () => {
      if (++calls > 3) throw new Error("offline");
      return grid(calls);
    });
    expect(readPack()["Débutant"]).toHaveLength(2);
    expect(readPack()["Facile"]).toHaveLength(1);
    expect(readPack()["Intermédiaire"]).toBeUndefined();
  });

  it("drops malformed grids from storage and from the server", async () => {
    window.localStorage.setItem(
      "sudoklash:offline-pack",
      JSON.stringify({ Facile: [grid(1), { puzzle: [1], solution: [1] }, null], Nope: [grid(2)] }),
    );
    expect(readPack()).toEqual({ Facile: [grid(1)] });
    window.localStorage.setItem("sudoklash:offline-pack", "{oops");
    expect(readPack()).toEqual({});
    await refillPack(async () => ({ puzzle: [], solution: [] }));
    expect(readPack()).toEqual({});
  });
});
