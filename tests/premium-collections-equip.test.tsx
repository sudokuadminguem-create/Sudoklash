// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PremiumCollections } from "@/app/_components/premium-collections";
import type { Cosmetics, CosmeticState } from "@/hooks/use-cosmetics";

vi.mock("@/app/_components/profile-card", () => ({ ProfileCardDisplay: () => null }));
vi.mock("@/app/_components/premium-effects", () => ({ VictoryEffect: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

const dragon = ["frame", "card", "effect"].map((kind) => `premium-dragon-${kind}`);

async function renderWith(action: Cosmetics["action"]) {
  const refresh = vi.fn(async () => null),
    notify = vi.fn();
  const state = {
    gems: 0,
    unlockedFrames: [dragon[0]],
    ownedCards: [dragon[1]],
    ownedEffects: [dragon[2]],
    frameSelection: "none",
    profileCardId: "none",
    victoryEffectId: "none",
    counts: { solo: 0, daily: 0, weekly: 0, wins: 0 },
  } as unknown as CosmeticState;
  const cosmetics = { state, loading: false, refresh, action } as unknown as Cosmetics;
  await act(async () =>
    root.render(
      <PremiumCollections
        cosmetics={cosmetics}
        signedIn
        username="alice"
        openAuth={() => {}}
        notify={notify}
      />,
    ),
  );
  const equipAll = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Équiper toute la collection",
  )!;
  await act(async () => equipAll.click());
  return { refresh, notify };
}

it("equips every item of an owned collection, then reads the state back once", async () => {
  const action = vi.fn(async () => ({}) as CosmeticState);
  const { refresh, notify } = await renderWith(action);
  expect(action.mock.calls).toEqual([
    ["equip_frame", dragon[0]],
    ["equip_profile_card", dragon[1]],
    ["equip_effect", dragon[2]],
  ]);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenCalledWith("Collection mise à jour sur ton compte.");
});

it("reports a collection that could not be fully equipped", async () => {
  const action = vi.fn(async (kind: string) => {
    if (kind === "equip_effect") throw new Error("effect_locked");
    return {} as CosmeticState;
  });
  const { refresh, notify } = await renderWith(action as Cosmetics["action"]);
  expect(refresh).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledWith(
    "Impossible de tout équiper. Tes achats restent dans ton inventaire.",
  );
});
