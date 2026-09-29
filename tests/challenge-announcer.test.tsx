// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ChallengeAnnouncer } from "@/app/_components/challenge-announcer";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/_components/player-cosmetics", () => ({
  PlayerAvatar: ({ frameId }: { frameId: string }) => <div data-frame={frameId} />,
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

it("announces every newly completed challenge once, including classic awards", async () => {
  const first = { id: "classic", name: "Première grille", requirement: "Terminer une grille", rarity: "simple", unlocked: true };
  const second = { id: "epic", name: "Expert", requirement: "Finir en expert", rarity: "epic", unlocked: true };
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ achievements: [first, second], newlyUnlocked: [first.id, second.id] }),
  });
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const account = { user: { id: "player" } } as Account;
  const cosmetics = { state: null } as Cosmetics;
  const discover = vi.fn();
  try {
    await act(async () => root.render(
      <ChallengeAnnouncer account={account} cosmetics={cosmetics} onDiscover={discover} />,
    ));
    expect(container.querySelector("[role=dialog]")?.textContent).toContain("DÉFI CLASSIQUE ACCOMPLI");
    expect(container.querySelector("[data-frame=classic]")).not.toBeNull();
    await act(async () => (container.querySelector("button") as HTMLButtonElement).click());
    expect(container.querySelector("[role=dialog]")?.textContent).toContain("DÉFI ÉPIQUE ACCOMPLI");
    expect(container.querySelector("[data-frame=epic]")).not.toBeNull();
    await act(async () => (container.querySelector("button") as HTMLButtonElement).click());
    expect(container.querySelector("[role=dialog]")).toBeNull();
    await act(async () => window.dispatchEvent(new Event("sudoklash:progress")));
    expect(container.querySelector("[role=dialog]")).toBeNull();
    expect(discover).toHaveBeenCalledTimes(2);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
