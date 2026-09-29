// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PlayerStats, timeTicks, type SoloStats } from "@/app/_components/player-stats";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const day = (n: number) => Date.parse(`2026-09-${String(n).padStart(2, "0")}T10:00:00Z`);
const win = (difficulty: string, seconds: number, d: number) => ({
  difficulty,
  elapsed_seconds: seconds,
  completed_at: day(d),
});
const stats: SoloStats = {
  byDifficulty: [
    { difficulty: "Expert", games: 1, best: 900, average: 900 },
    { difficulty: "Facile", games: 5, best: 150, average: 240 },
  ],
  history: [
    win("Facile", 400, 1),
    win("Facile", 380, 2),
    win("Expert", 900, 3),
    win("Facile", 200, 4),
    win("Facile", 160, 5),
    win("Facile", 150, 6),
  ],
  streak: { current: 3, best: 5, playedToday: false },
};

const render = (value: SoloStats = stats) =>
  act(async () => root.render(<PlayerStats stats={value} />));
const text = () => container.textContent ?? "";

describe("timeTicks", () => {
  it("gives round values from zero up to the largest time", () => {
    expect(timeTicks(150)).toEqual([0, 60, 120, 180]);
    expect(timeTicks(900)).toEqual([0, 300, 600, 900]);
    expect(timeTicks(1)).toEqual([0, 15]);
    expect(timeTicks(100_000).at(0)).toBe(0);
  });
});

describe("player statistics", () => {
  it("shows the streaks and what to do to keep one", async () => {
    await render();
    expect(text()).toContain("3 jours");
    expect(text()).toContain("5 jours");
    expect(text()).toContain("Joue aujourd’hui pour la prolonger.");
    await render({ ...stats, streak: { current: 1, best: 1, playedToday: true } });
    expect(text()).toContain("1 jour");
    expect(text()).toContain("Prolongée aujourd’hui.");
    await render({ ...stats, streak: { current: 0, best: 0, playedToday: false } });
    expect(text()).toContain("Termine une grille aujourd’hui pour lancer une série.");
  });

  it("lists the difficulties played in difficulty order with best and average times", async () => {
    await render();
    const rows = [...container.querySelectorAll(".difficulty-table tbody tr")].map((row) =>
      [...row.children].map((cell) => cell.textContent),
    );
    expect(rows).toEqual([
      ["Facile", "5", "02:30", "04:00"],
      ["Expert", "1", "15:00", "15:00"],
    ]);
  });

  it("plots the most played difficulty first, with its record", async () => {
    await render();
    const title = container.querySelector(".progression-head h4")!.textContent;
    expect(title).toContain("5 dernières grilles Facile");
    expect(container.querySelector(".plot-line")).not.toBeNull();
    expect(container.querySelector(".plot-label")!.textContent).toBe("Record 02:30");
    expect(container.querySelector(".progression-trend")!.textContent).toContain("plus rapide");
  });

  it("switches the chart to another difficulty and says when there is too little to plot", async () => {
    await render();
    const expert = [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')].find(
      (b) => b.textContent === "Expert",
    )!;
    await act(async () => expert.click());
    expect(expert.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector(".progression-plot svg")).toBeNull();
    expect(text()).toContain("Termine au moins deux grilles Expert");
  });

  it("offers the same results as a table, newest first", async () => {
    await render();
    const toggle = container.querySelector<HTMLButtonElement>(".stats-link")!;
    await act(async () => toggle.click());
    const times = [...container.querySelectorAll(".progression-table tbody td:last-child")].map(
      (td) => td.textContent,
    );
    expect(times).toEqual(["02:30", "02:40", "03:20", "06:20", "06:40"]);
    expect(container.querySelector(".progression-plot svg")).toBeNull();
    await act(async () => toggle.click());
    expect(container.querySelector(".progression-plot svg")).not.toBeNull();
  });

  it("reads a time off the chart when hovering it", async () => {
    await render();
    const svg = container.querySelector(".progression-plot svg")!;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 220 }) as DOMRect;
    // Far left of the plot: the oldest result.
    await act(async () => {
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 0 }));
    });
    const tooltip = container.querySelector(".plot-tooltip")!;
    expect(tooltip.textContent).toContain("06:40");
    // Far right: the record, which says so.
    await act(async () => {
      svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 600 }));
    });
    expect(container.querySelector(".plot-tooltip")!.textContent).toContain("Ton record");
    await act(async () => {
      svg.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
      svg.dispatchEvent(new MouseEvent("pointerleave"));
    });
  });

  it("invites the player to play when there is nothing yet", async () => {
    await render({
      byDifficulty: [],
      history: [],
      streak: { current: 0, best: 0, playedToday: false },
    });
    expect(text()).toContain("Termine une grille solo pour voir tes statistiques.");
    expect(container.querySelector("table")).toBeNull();
  });
});
