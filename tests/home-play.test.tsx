// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuestDailyInvite, HomeAccountButton, PlayModeContent } from "@/app/_components/home-play";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { mount } from "./support/render";

vi.mock("@/app/_components/player-cosmetics", () => ({
  PlayerAvatar: ({ fallback }: { fallback?: string }) => <i>{fallback ?? "avatar"}</i>,
}));
vi.mock("@/app/_components/tournaments", () => ({
  Tournaments: ({ userId, coins }: { userId?: string; coins?: number }) => (
    <p>
      tournaments {userId ?? "guest"} {coins}
    </p>
  ),
}));
vi.mock("@/app/_components/ranked-match", () => ({ RankedMatch: () => <p>ranked</p> }));
vi.mock("@/app/_components/ranked-game", () => ({ RankedGame: () => null }));
vi.mock("@/app/_components/friend-duel", () => ({
  FriendDuel: ({ target }: { target?: { username: string } | null }) => (
    <p>duel {target?.username ?? "none"}</p>
  ),
}));
vi.mock("@/app/_components/mode-panel", () => ({
  ModePanel: ({ mode }: { mode: string }) => <p>panel {mode}</p>,
}));

const account = (signedIn: boolean, username: string | null = "Alice") =>
  ({
    user: signedIn ? { id: "alice" } : null,
    profile: username ? { username } : null,
    loading: false,
  }) as unknown as Account;
const cosmetics = {
  state: { level: 7, coins: 420, avatarId: "nova", frameId: "starter" },
  refresh: vi.fn(),
} as unknown as Cosmetics;

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

describe("HomeAccountButton", () => {
  it("shows the level and the profile link to a signed-in player", async () => {
    const onClick = vi.fn();
    view = await mount(
      <HomeAccountButton account={account(true)} cosmetics={cosmetics} onClick={onClick} />,
    );
    const text = view.container.textContent;
    expect(text).toContain("7");
    expect(text).toContain("Alice");
    expect(text).not.toContain("?");
    act(() => view!.container.querySelector("button")!.click());
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("invites a guest to sign in, with a placeholder avatar", async () => {
    view = await mount(
      <HomeAccountButton account={account(false, null)} cosmetics={cosmetics} onClick={() => {}} />,
    );
    expect(view.container.querySelector("i")!.textContent).toBe("?");
    expect(view.container.querySelector("b")!.textContent).not.toBe("");
  });
});

describe("GuestDailyInvite", () => {
  it("points a guest to the daily challenge", async () => {
    const onDiscover = vi.fn();
    view = await mount(
      <GuestDailyInvite fr daily={false} onDiscover={onDiscover} onSignup={() => {}} />,
    );
    expect(view.container.textContent).toContain("le défi du jour");
    act(() => view!.container.querySelector("button")!.click());
    expect(onDiscover).toHaveBeenCalledOnce();
  });

  it("asks a guest already on the daily challenge to sign up, in English too", async () => {
    const onSignup = vi.fn();
    view = await mount(
      <GuestDailyInvite fr={false} daily onDiscover={() => {}} onSignup={onSignup} />,
    );
    expect(view.container.textContent).toContain("Unlock the daily challenge");
    act(() => view!.container.querySelector("button")!.click());
    expect(onSignup).toHaveBeenCalledOnce();
  });

  it("is written in English for an English guest who has not opened the daily challenge", async () => {
    view = await mount(
      <GuestDailyInvite fr={false} daily={false} onDiscover={() => {}} onSignup={() => {}} />,
    );
    expect(view.container.textContent).toContain("Try today’s challenge");
  });
});

describe("PlayModeContent", () => {
  const render = (mode: string, signedIn = true) =>
    mount(
      <PlayModeContent
        mode={mode}
        account={account(signedIn)}
        cosmetics={cosmetics}
        notify={() => {}}
        openAuth={() => {}}
        tournaments={{
          feed: { list: [], error: false, now: 0, refresh: () => {} },
          id: null,
          onOpen: () => {},
        }}
        duelTarget={{ id: "bob", username: "Bob" }}
        onDuelTargetUsed={() => {}}
      />,
    );

  it.each([
    ["tournaments", "tournaments alice 420"],
    ["classée", "ranked"],
    ["duel", "duel Bob"],
    ["daily", "panel daily"],
    ["solo", "panel solo"],
  ])("shows the %s mode", async (mode, expected) => {
    view = await render(mode);
    expect(view.container.textContent).toBe(expected);
  });

  it("opens the daily panel for a guest too", async () => {
    view = await render("daily", false);
    expect(view.container.textContent).toBe("panel daily");
  });
});
