// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Shop } from "@/app/_components/shop";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics, CosmeticState } from "@/hooks/use-cosmetics";

vi.mock("@/app/_components/player-cosmetics", () => ({ PlayerAvatar: () => null }));
vi.mock("@/app/_components/premium-collections", () => ({
  PremiumCollections: () => <p>collections</p>,
}));
vi.mock("@/app/_components/premium-packs", () => ({ PremiumPacks: () => <p>gem packs</p> }));
vi.mock("@/app/_components/support", () => ({ SupportShop: () => <p>support shop</p> }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  // jsdom has no modal dialogs: open and close them by their attribute.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
});

const state = (overrides: Partial<CosmeticState> = {}) =>
  ({
    coins: 300,
    gems: 0,
    ownedThemes: ["ocean"],
    ownedAvatars: ["nova"],
    unlockedFrames: ["none"],
    themeId: "ocean",
    avatarId: "nova",
    frameSelection: "none",
    customAvatar: null,
    ...overrides,
  }) as CosmeticState;

function setup({
  user = { id: "alice" } as Account["user"],
  data = state() as CosmeticState | null,
  action = vi.fn(async () => {}),
  loading = false,
} = {}) {
  const notify = vi.fn(),
    openAuth = vi.fn(),
    refresh = vi.fn(async () => {});
  const cosmetics = { state: data, loading, refresh, action } as unknown as Cosmetics;
  const account = { user, profile: null } as unknown as Account;
  return { notify, openAuth, refresh, action, cosmetics, account };
}

const render = (props: ReturnType<typeof setup>) =>
  act(async () =>
    root.render(
      <Shop
        notify={props.notify}
        cosmetics={props.cosmetics}
        account={props.account}
        openAuth={props.openAuth}
      />,
    ),
  );
const buttons = () => [...container.querySelectorAll<HTMLButtonElement>("button")];
const button = (text: string) => buttons().find((b) => b.textContent?.trim() === text)!;
const click = (element: HTMLElement) => act(async () => element.click());
const dialog = () => container.querySelector<HTMLDialogElement>(".store-dialog")!;

it("shows the balances, filters the catalog and switches currency", async () => {
  const props = setup();
  await render(props);
  expect(container.querySelector(".store-balances")?.textContent).toContain("300");
  const all = Number.parseInt(container.querySelector(".store-count")!.textContent!, 10);
  await click(button("Fonds de grille"));
  expect(button("Fonds de grille").getAttribute("aria-pressed")).toBe("true");
  const themes = container.querySelectorAll(".store-product[data-kind='theme']").length;
  expect(themes).toBeGreaterThan(0);
  expect(container.querySelectorAll(".store-product").length).toBe(themes);
  expect(themes).toBeLessThan(all);
  await click(button("Payer en Sudogemmes"));
  expect(button("Payer en Sudogemmes").className).toBe("active");
  expect(container.textContent).toContain("Sudogemmes");
});

it("lists only owned articles on the owned shelf and resets the category", async () => {
  const props = setup();
  await render(props);
  await click(button("Avatars"));
  await click(button("Mes articles"));
  expect(button("Tout").getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelector(".store-help")).toBeNull();
  const owned = [...container.querySelectorAll(".store-product h3")].map((h) => h.textContent);
  expect(owned.length).toBeGreaterThan(0);
  expect(container.querySelector(".store-count")?.textContent).toContain("possédé");
  expect(container.querySelector(".store-owned")?.textContent).toContain("Équipé");
});

it("opens the other shelves", async () => {
  await render(setup());
  await click(button("Collections"));
  expect(container.textContent).toContain("collections");
  await click(button("Sudogemmes"));
  expect(container.textContent).toContain("gem packs");
  await click(button("Dons"));
  expect(container.textContent).toContain("support shop");
});

it("lands on the support shelf after a donation and on gems after a purchase", async () => {
  window.history.replaceState(null, "", "/?support_cancelled=1");
  await render(setup());
  expect(container.textContent).toContain("support shop");
  await act(async () => root.unmount());
  root = createRoot(container);
  window.history.replaceState(null, "", "/?premium_session=cs_test_1");
  await render(setup());
  expect(container.textContent).toContain("gem packs");
});

it("buys an article after confirmation and tells when coins are short", async () => {
  const props = setup({ data: state({ coins: 100_000 }) });
  await render(props);
  await click(button("Fonds de grille"));
  const card = [...container.querySelectorAll<HTMLElement>(".store-product")].find(
    (c) => !c.querySelector(".store-owned"),
  )!;
  const name = card.querySelector("h3")!.textContent!;
  await click(card.querySelector<HTMLButtonElement>(".store-equip")!);
  expect(dialog().open).toBe(true);
  expect(dialog().textContent).toContain(name);
  const buy = dialog().querySelector<HTMLButtonElement>(".primary")!;
  expect(buy.textContent).toBe("Acheter");
  await click(buy);
  expect(dialog().open).toBe(false);
  const confirm = document.querySelector<HTMLElement>(".confirm-dialog")!;
  expect(confirm.textContent).toContain(`Acheter ${name} ?`);
  const accept = [...confirm.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.textContent?.startsWith("Acheter ·"),
  )!;
  await click(accept);
  expect(props.action).toHaveBeenCalledWith(
    expect.stringMatching(/^buy_/),
    expect.any(String),
    "coins",
  );
  expect(props.notify).toHaveBeenCalledWith(expect.stringContaining(`${name} acheté`));

  props.action.mockRejectedValueOnce(new Error("not_enough_coins"));
  await click(card.querySelector<HTMLButtonElement>(".store-equip")!);
  await click(dialog().querySelector<HTMLButtonElement>(".primary")!);
  const again = [...document.querySelectorAll<HTMLButtonElement>(".confirm-dialog button")].find(
    (b) => b.textContent?.startsWith("Acheter ·"),
  )!;
  await click(again);
  expect(props.notify).toHaveBeenLastCalledWith("Solde insuffisant. Aucun achat effectué.");
});

it("reports any other failed purchase", async () => {
  const props = setup({
    data: state({ coins: 100_000 }),
    action: vi.fn(async () => Promise.reject(new Error("boom"))),
  });
  await render(props);
  await click(button("Fonds de grille"));
  const card = [...container.querySelectorAll<HTMLElement>(".store-product")].find(
    (c) => !c.querySelector(".store-owned"),
  )!;
  await click(card.querySelector<HTMLButtonElement>(".store-equip")!);
  await click(dialog().querySelector<HTMLButtonElement>(".primary")!);
  await click(
    [...document.querySelectorAll<HTMLButtonElement>(".confirm-dialog button")].find((b) =>
      b.textContent?.startsWith("Acheter ·"),
    )!,
  );
  expect(props.notify).toHaveBeenLastCalledWith(
    "Achat indisponible. Vérifie ton inventaire avant de réessayer.",
  );
});

it("equips an owned article and reports a failure", async () => {
  const props = setup({ data: state({ themeId: "none-equipped" }) });
  await render(props);
  await click(button("Fonds de grille"));
  const owned = container.querySelector<HTMLElement>(".store-product .store-owned")!;
  expect(owned.textContent).toContain("Possédé");
  await click(owned.closest<HTMLButtonElement>("button")!);
  const equip = dialog().querySelector<HTMLButtonElement>(".primary")!;
  expect(dialog().querySelector(".store-price")?.textContent).toBe("Possédé");
  expect(equip.textContent).toBe("Équiper");
  await click(equip);
  expect(props.action).toHaveBeenCalledWith("equip_theme", "ocean");
  expect(props.notify).toHaveBeenCalledWith(expect.stringContaining("équipé"));
  props.action.mockRejectedValueOnce(new Error("nope"));
  await click(dialog().querySelector<HTMLButtonElement>(".primary")!);
  expect(props.notify).toHaveBeenLastCalledWith("Impossible d’équiper cet article. Réessaie.");
});

it("closes the preview from its button, the backdrop and Escape", async () => {
  await render(setup());
  const open = () => click(container.querySelector<HTMLButtonElement>(".store-preview-trigger")!);
  await open();
  await click(dialog().querySelector<HTMLButtonElement>(".store-dialog-close")!);
  expect(dialog().open).toBe(false);
  await open();
  await click(dialog().querySelector<HTMLElement>(".store-dialog-inner")!);
  expect(dialog().open).toBe(true);
  await click(dialog());
  expect(dialog().open).toBe(false);
  await open();
  await act(async () => dialog().dispatchEvent(new Event("cancel")));
  expect(container.querySelector(".store-dialog-inner")).toBeNull();
});

it("shows what is missing when the balance is too low", async () => {
  await render(setup({ data: state({ coins: 0 }) }));
  await click(button("Fonds de grille"));
  const card = [...container.querySelectorAll<HTMLElement>(".store-product")].find(
    (c) => !c.querySelector(".store-owned"),
  )!;
  expect(card.querySelector(".store-shortfall")?.textContent).toContain("Il te manque");
  await click(card.querySelector<HTMLButtonElement>(".store-equip")!);
  expect(dialog().querySelector<HTMLButtonElement>(".primary")!.disabled).toBe(true);
  expect(dialog().textContent).toContain("Il te manque");
});

it("asks a guest to sign in before buying", async () => {
  const props = setup({ user: null, data: null });
  await render(props);
  expect(container.querySelector(".store-message")?.textContent).toContain("Connecte-toi");
  await click(container.querySelector<HTMLButtonElement>(".store-message .primary")!);
  expect(props.openAuth).toHaveBeenCalledOnce();
  await click(container.querySelector<HTMLButtonElement>(".store-preview-trigger")!);
  const action = dialog().querySelector<HTMLButtonElement>(".primary")!;
  expect(action.textContent).toBe("Se connecter");
  await click(action);
  expect(props.openAuth).toHaveBeenCalledTimes(2);
  expect(dialog().open).toBe(false);
  await click(button("Mes articles"));
  expect(container.textContent).toContain("Connecte-toi pour retrouver tes articles.");
});

it("offers to reload a balance that could not be loaded", async () => {
  const props = setup({ data: null });
  await render(props);
  expect(container.querySelector("[role='status']")?.textContent).toContain("indisponible");
  await click(button("Réessayer"));
  expect(props.refresh).toHaveBeenCalledOnce();
  await render({ ...props, cosmetics: { ...props.cosmetics, loading: true } });
  expect(container.querySelector("[role='status']")?.textContent).toContain("Chargement");
  await click(button("Mes articles"));
  expect(container.textContent).toContain("Aucun article dans ce rayon");
});
