// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Tournaments } from "@/app/_components/tournaments";
import { mount, replyWith } from "./support/render";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/_components/sudoku-board", () => ({ SudokuBoard: () => null }));

const now = Date.UTC(2026, 10, 18, 12);
type Feed = Parameters<typeof Tournaments>[0]["feed"];
const feed = (extra: Partial<Feed> = {}): Feed => ({
  list: [],
  error: false,
  now,
  refresh: vi.fn(),
  ...extra,
});
const tournament = (phase: string) => ({
  id: "t1",
  difficulty: "Expert",
  starts_at: now + 5 * 60_000,
  ends_at: now + 35 * 60_000,
  phase,
  size: 4,
  pot: 125,
});

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
});

async function openDetail(phase: string, extra: object = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      replyWith({
        now,
        tournament: tournament(phase),
        puzzle: null,
        entry: null,
        ranking: [],
        estimates: [60, 40, 25],
        ...extra,
      }),
    ),
  );
  view = await mount(
    <Tournaments
      feed={feed()}
      id="t1"
      onOpen={() => {}}
      userId="alice"
      openAuth={() => {}}
      walletRefresh={() => {}}
    />,
  );
  return view.container;
}

describe("Tournament detail", () => {
  it("opens registrations with the start time and the estimated prizes", async () => {
    const container = await openDetail("open");
    expect(container.textContent).toContain("Inscriptions ouvertes");
    expect(container.textContent).toContain("Départ dans 05:00");
    expect([...container.querySelectorAll("details li")].map((li) => li.textContent)).toEqual([
      "60 Sudokoins",
      "40 Sudokoins",
      "25 Sudokoins",
    ]);
    expect(container.querySelector<HTMLButtonElement>("button.primary")!.textContent).toContain(
      "Rejoindre",
    );
  });

  it("tells a registered player the grid opens at the start", async () => {
    const container = await openDetail("open", {
      entry: { finished: false, mistakes: 0, payout: 0 },
    });
    expect(container.textContent).toContain("Tu es inscrit.");
  });

  it("ranks the players during the game and closes registrations", async () => {
    const container = await openDetail("playing", {
      entry: { finished: true, mistakes: 3, payout: 0 },
      ranking: [
        { place: 1, name: "Alice", seconds: 301.5, mistakes: 1, payout: 60, self: true },
        { place: 2, name: "Bob", seconds: 420, mistakes: 0, payout: 40, self: false },
      ],
    });
    expect(container.textContent).toContain("Fin dans 35:00");
    expect(container.textContent).toContain("Grille validée !");
    expect(container.textContent).toContain("Tentative terminée : trois erreurs.");
    const rows = [...container.querySelectorAll(".tournament-ranking li")].map(
      (li) => li.textContent,
    );
    expect(rows[0]).toContain("1. Alice (toi)");
    expect(rows[0]).toContain("1 erreur");
    expect(rows[1]).toContain("0 erreurs");
    expect(rows[1]).not.toContain("Sudokoins");
  });

  it("closes registrations for a player who did not join in time", async () => {
    const container = await openDetail("playing");
    expect(container.textContent).toContain("Les inscriptions sont fermées.");
    expect(container.textContent).toContain("Aucun résultat validé.");
  });

  it("shows the prizes of a finished tournament", async () => {
    const container = await openDetail("finished", {
      entry: { finished: true, mistakes: 0, payout: 60 },
      ranking: [{ place: 1, name: "Alice", seconds: 300, mistakes: 0, payout: 60, self: true }],
    });
    expect(container.textContent).toContain("Ton gain : 60 Sudokoins");
    expect(container.querySelector(".tournament-ranking")!.textContent).toContain("60 Sudokoins");
  });

  it("refunds the stake of a cancelled tournament", async () => {
    let container = await openDetail("cancelled", {
      entry: { finished: false, mistakes: 0, payout: 25 },
    });
    expect(container.textContent).toContain("Mise remboursée : 25 Sudokoins.");
    expect(container.querySelector(".tournament-ranking")).toBeNull();
    await view!.unmount();
    container = await openDetail("cancelled");
    expect(container.textContent).toContain("Les mises ont été remboursées.");
  });
});

describe("Tournament list", () => {
  const render = (extra: Partial<Feed>) =>
    mount(
      <Tournaments
        feed={feed(extra)}
        id={null}
        onOpen={onOpen}
        openAuth={() => {}}
        walletRefresh={() => {}}
      />,
    );
  const onOpen = vi.fn();

  it("offers to reload a feed that failed", async () => {
    const refresh = vi.fn();
    view = await render({ error: true, refresh });
    const retry = [...view.container.querySelectorAll("button")].find((b) =>
      b.textContent!.includes("Réessayer"),
    )!;
    act(() => retry.click());
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("waits for the feed, then says when there is nothing to join", async () => {
    view = await render({ list: null });
    expect(view.container.textContent).toContain("Chargement…");
    await view.rerender(
      <Tournaments
        feed={feed()}
        id={null}
        onOpen={onOpen}
        openAuth={() => {}}
        walletRefresh={() => {}}
      />,
    );
    expect(view.container.textContent).toContain("Pas de tournois en cours");
  });

  it("lists the tournaments with the start of those still open", async () => {
    view = await render({
      list: [tournament("open"), { ...tournament("finished"), id: "t2", difficulty: "Facile" }],
    } as Partial<Feed>);
    const items = [...view.container.querySelectorAll(".tournament-list li")];
    expect(items[0].textContent).toContain("Expert · Inscriptions ouvertes");
    expect(items[0].textContent).toContain("Départ dans 05:00");
    expect(items[1].textContent).not.toContain("Départ");
    act(() => items[1].querySelector("button")!.click());
    expect(onOpen).toHaveBeenCalledWith("t2");
  });
});
