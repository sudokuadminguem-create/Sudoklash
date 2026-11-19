// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { Leaderboard } from "@/app/_components/leaderboard";
import { DailyChallenges } from "@/app/_components/daily-challenges";
import { PrivacySettings } from "@/app/_components/privacy-settings";
import { TournamentBanner } from "@/app/_components/tournaments";
import { mount, replyWith } from "./support/render";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("@/app/_components/timed-challenge", () => ({ TimedChallenge: () => null }));

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
});

const failing = () => vi.fn(async () => new Response("{}", { status: 500 }));
const pending = () => vi.fn(() => new Promise<Response>(() => {}));
const text = () => view!.container.textContent ?? "";

describe("Leaderboard", () => {
  const player = (position: number) => ({
    position,
    username: `joueur${position}`,
    points: 2000 - position,
    wins: 10,
    losses: 2,
    rank: { label: "Maître" },
    avatarId: "cat",
    frameId: "starter",
    image: null,
  });

  it("says it is loading until the ranking arrives", async () => {
    vi.stubGlobal("fetch", pending());
    view = await mount(<Leaderboard />);
    expect(text()).toContain("Chargement du classement…");
  });

  it("reports an unavailable ranking", async () => {
    vi.stubGlobal("fetch", failing());
    view = await mount(<Leaderboard />);
    expect(text()).toContain("Classement momentanément indisponible.");
    expect(text()).not.toContain("premières parties classées");
  });

  it("explains an empty ranking", async () => {
    vi.stubGlobal("fetch", vi.fn(replyWith({ players: [] })));
    view = await mount(<Leaderboard />);
    expect(text()).toContain("Le classement s’affichera dès les premières parties classées.");
  });

  it("shows the podium and the table", async () => {
    vi.stubGlobal("fetch", vi.fn(replyWith({ players: [player(1), player(2)] })));
    view = await mount(<Leaderboard />);
    expect(view.container.querySelectorAll(".pod")).toHaveLength(2);
    expect(view.container.querySelectorAll(".rank-table .tr:not(.head)")).toHaveLength(2);
    expect(text()).not.toContain("Chargement");
  });
});

describe("Daily ranking", () => {
  async function openRanking() {
    view = await mount(<DailyChallenges openAuth={() => {}} cosmetics={{} as Cosmetics} />);
    const button = [...view.container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Classement ·"),
    )!;
    await act(async () => button.click());
    await act(async () => new Promise((r) => setTimeout(r, 0)));
  }

  it("shows a loading message in an output element", async () => {
    vi.stubGlobal("fetch", pending());
    await openRanking();
    expect(view!.container.querySelector("output")?.textContent).toBe("Chargement du classement…");
  });

  it("asks a guest to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    await openRanking();
    expect(text()).toContain("Se connecter pour voir le classement");
  });

  it("offers a retry when the ranking fails", async () => {
    vi.stubGlobal("fetch", failing());
    await openRanking();
    expect(text()).toContain("Classement momentanément indisponible.");
  });

  it("invites the first player when nobody has finished", async () => {
    vi.stubGlobal("fetch", vi.fn(replyWith({ players: [] })));
    await openRanking();
    expect(text()).toContain("Soyez le premier !");
  });

  it("lists the players with their mistakes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        replyWith({
          players: [
            {
              userId: "u1",
              position: 1,
              username: "alice",
              seconds: 95,
              mistakes: 2,
              avatarId: "cat",
              frameId: "starter",
              image: null,
            },
          ],
        }),
      ),
    );
    await openRanking();
    expect(view!.container.querySelector(".daily-ranking-list")?.textContent).toContain("alice");
    expect(text()).toContain("2 erreurs");
  });
});

describe("Privacy settings", () => {
  const account = { user: { id: "u1" } } as unknown as Account;
  const render = () =>
    mount(<PrivacySettings account={account} openAuth={() => {}} notify={() => {}} />);

  it("shows a loading message in an output element", async () => {
    vi.stubGlobal("fetch", pending());
    view = await render();
    expect(view.container.querySelector("output")?.textContent).toBe("Chargement…");
  });

  it("offers a retry when the information cannot be loaded", async () => {
    vi.stubGlobal("fetch", failing());
    view = await render();
    expect(view.container.querySelector("[role=alert]")?.textContent).toContain("Réessayer");
    expect(view.container.querySelector("output")).toBeNull();
  });

  it("lists the connection details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        replyWith({
          email: "a@example.com",
          createdAt: "2026-01-01T10:00:00Z",
          lastSignInAt: null,
          emailConfirmed: true,
          providers: ["email"],
        }),
      ),
    );
    view = await render();
    expect(view.container.querySelector(".privacy-connection")?.textContent).toContain(
      "a@example.com",
    );
  });
});

describe("Tournament banner", () => {
  type Feed = Parameters<typeof TournamentBanner>[0]["feed"];
  const feed = (extra: Partial<Feed>): Feed => ({
    list: [],
    error: false,
    now: 0,
    refresh: vi.fn(),
    ...extra,
  });
  const tournament = (phase: string) => ({
    id: "t1",
    difficulty: "Expert",
    starts_at: 60_000,
    ends_at: 120_000,
    phase,
    size: 4,
    pot: 125,
  });
  const banner = async (extra: Partial<Feed>) => {
    view = await mount(<TournamentBanner feed={feed(extra)} onOpen={() => {}} />);
    return view.container.querySelector(".tournament-link")?.textContent;
  };

  it("names the state of the feed when no tournament runs", async () => {
    expect(await banner({ error: true, list: null })).toBe("Tournois");
    expect(text()).toContain("Tournois indisponibles");
    await view!.unmount();
    await banner({ list: null });
    expect(text()).toContain("Chargement des tournois…");
    await view!.unmount();
    await banner({ list: [] });
    expect(text()).toContain("Pas de tournois en cours");
  });

  it("links to the ranking of a running tournament and to an open one", async () => {
    expect(await banner({ list: [tournament("playing")] as Feed["list"] })).toBe(
      "Voir le classement",
    );
    await view!.unmount();
    expect(await banner({ list: [tournament("open")] as Feed["list"] })).toBe("Voir le tournoi");
  });
});
