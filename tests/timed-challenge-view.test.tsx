// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { TimedChallenge } from "@/app/_components/timed-challenge";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { mount, replyWith } from "./support/render";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/_components/sudoku-board", () => ({
  SudokuBoard: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

const cosmetics = { refresh: vi.fn() } as unknown as Cosmetics;
const tomorrow = () => new Date(Date.now() + 3_600_000).toISOString();

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
});

async function render(kind: "daily" | "weekly", status: string, extra: object = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      replyWith({
        status,
        title: "Grille 42",
        puzzle: Array(81).fill(0),
        nextAt: tomorrow(),
        startedAt: null,
        elapsedSeconds: 312,
        mistakes: 0,
        ...extra,
      }),
    ),
  );
  view = await mount(
    <TimedChallenge kind={kind} difficulty="Difficile" openAuth={() => {}} cosmetics={cosmetics} />,
  );
  return view.container;
}

describe("TimedChallenge", () => {
  it("shows the time of a finished grid and when the next one comes", async () => {
    const container = await render("daily", "completed");
    expect(container.textContent).toContain("GRILLE TERMINÉE");
    expect(container.textContent).toContain("Prochaine grille dans");
  });

  it("closes a grid lost after three mistakes", async () => {
    const container = await render("weekly", "failed");
    expect(container.textContent).toContain("Trois erreurs : grille perdue");
    expect(container.textContent).toContain("Nouvelle grille dans");
  });

  it("titles a daily grid with its difficulty and states its rules", async () => {
    const container = await render("daily", "in_progress", { startedAt: new Date().toISOString() });
    expect(container.querySelector("h2")!.textContent).toBe(
      "Grille 42 · Difficile — Défi quotidien",
    );
    expect(container.querySelector(".weekly-rules h3")!.textContent).toBe(
      "Une chance par jour et par difficulté",
    );
  });

  it("titles a weekly grid without a difficulty", async () => {
    const container = await render("weekly", "not_started");
    expect(container.querySelector("h2")!.textContent).toBe("Grille 42 — Défi hebdomadaire");
    expect(container.querySelector(".weekly-rules h3")!.textContent).toBe("Une chance par semaine");
  });
});
