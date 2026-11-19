// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankedMatch, type RankedState } from "@/app/_components/ranked-match";
import type { AccountState } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { mount, replyWith } from "./support/render";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));

const account = { user: { id: "alice" }, profile: null, loading: false } as unknown as AccountState;
const cosmetics = { refresh: vi.fn(async () => ({ xp: 520 })) } as unknown as Cosmetics;

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
});

async function render(state: RankedState) {
  vi.stubGlobal("fetch", vi.fn(replyWith(state)));
  view = await mount(
    <RankedMatch
      account={account}
      cosmetics={cosmetics}
      openAuth={() => {}}
      renderGame={() => <p>game</p>}
    />,
  );
  return view.container;
}

const finished = (extra: Partial<RankedState>): RankedState => ({
  status: "finished",
  id: "m1",
  difficulty: "Facile",
  opponentName: "Bob",
  winnerId: "alice",
  finishReason: "completed",
  durationSeconds: 125,
  myFilled: 51,
  opponentFilled: 30,
  totalToFill: 51,
  difference: 21,
  points: 1240,
  pointsChange: 24,
  rank: { label: "Argent 2", difficulty: "Facile", progress: 40 },
  ...extra,
});

describe("RankedMatch summary", () => {
  it("sums up a win with the points and the XP it earned", async () => {
    const container = await render(finished({ finishReason: "forfeit" }));
    const text = container.textContent;
    expect(text).toContain("Victoire !");
    expect(text).toContain("Ton adversaire a abandonné");
    expect(text).toContain("+24 points");
    expect(text).toContain("Argent 2 · 1240 points");
    expect(container.querySelector(".ranked-points")!.className).toContain("gain");
    expect(container.querySelector("progress")).not.toBeNull();
  });

  it("explains a loss after three mistakes", async () => {
    const container = await render(
      finished({ winnerId: "bob", finishReason: "three_mistakes", pointsChange: -12 }),
    );
    expect(container.textContent).toContain("Défaite");
    expect(container.textContent).toContain("Fin après trois erreurs");
    expect(container.textContent).toContain("-12 points");
    expect(container.querySelector(".ranked-points")!.className).toContain("loss");
  });

  it("says when the player gave up, and waits for the points", async () => {
    const container = await render(
      finished({ winnerId: "bob", finishReason: "forfeit", pointsChange: null }),
    );
    expect(container.textContent).toContain("Partie abandonnée");
    expect(container.textContent).toContain("Calcul des points…");
  });

  it("starts the search for another match", async () => {
    const container = await render(finished({}));
    const fetchMock = vi.mocked(fetch);
    await act(async () => container.querySelector<HTMLButtonElement>(".primary")!.click());
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(init!.body))).toEqual({ action: "join" });
  });
});

describe("RankedMatch lobby", () => {
  it("shows the queue and lets the player leave it", async () => {
    const container = await render({
      status: "waiting",
      rank: { label: "Bronze 3", difficulty: "Intermédiaire", progress: 0 },
    });
    expect(container.textContent).toContain("Recherche d’un adversaire…");
    expect(container.querySelector("[role=status]")!.textContent).toContain("Grille Intermédiaire");
    await act(async () => container.querySelector<HTMLButtonElement>(".ranked-cancel")!.click());
    const [, init] = vi.mocked(fetch).mock.calls.at(-1)!;
    expect(JSON.parse(String(init!.body))).toEqual({ action: "cancel" });
  });

  it("offers to find a match, with the default rank before any game", async () => {
    const container = await render({ status: "idle" });
    expect(container.textContent).toContain("PARTIE CLASSÉE · Bronze 1");
    expect(container.textContent).toContain("Grille Facile · 0 points classés");
  });

  it("reports an unavailable matchmaking", async () => {
    vi.stubGlobal("fetch", vi.fn(replyWith({ error: "down" }, 503)));
    view = await mount(
      <RankedMatch
        account={account}
        cosmetics={cosmetics}
        openAuth={() => {}}
        renderGame={() => null}
      />,
    );
    expect(view.container.querySelector("[role=alert]")!.textContent).toContain(
      "momentanément indisponible",
    );
  });
});
