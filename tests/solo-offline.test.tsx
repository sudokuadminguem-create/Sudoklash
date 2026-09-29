// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaStatus } from "@/app/_components/pwa-status";
import { SoloGame } from "@/app/_components/solo-game";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { solveGrid } from "@/lib/sudoku-solver";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
  .split("")
  .map(Number);
const solution = solveGrid(puzzle)!;
const guestAccount = { loading: false, user: null, profile: null } as unknown as Account;
const cosmetics = { refresh: async () => null } as unknown as Cosmetics;

let root: Root, container: HTMLDivElement;
beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const renderSolo = () =>
  act(async () =>
    root.render(
      <SoloGame
        difficulty="Facile"
        account={guestAccount}
        cosmetics={cosmetics}
        openAuth={() => {}}
      />,
    ),
  );

describe("solo without a connection", () => {
  it("starts a stocked practice grid and says it earns nothing", async () => {
    window.localStorage.setItem(
      "sudoklash:offline-pack",
      JSON.stringify({ Facile: [{ puzzle, solution }] }),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await renderSolo();
    expect(container.querySelector(".sudoku")).not.toBeNull();
    expect(container.querySelector(".offline-note")?.textContent).toContain("Hors ligne");
    expect(JSON.parse(window.localStorage.getItem("sudoklash:offline-pack")!).Facile).toEqual([]);
  });

  it("shows the usual error when there is no spare grid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await renderSolo();
    expect(container.querySelector(".sudoku")).toBeNull();
    expect(container.textContent).toContain("Impossible de charger une grille");
  });

  it("shows no offline note when the server answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ guest: true, puzzle, solution })),
    );
    await renderSolo();
    expect(container.querySelector(".sudoku")).not.toBeNull();
    expect(container.querySelector(".offline-note")).toBeNull();
  });
});

describe("offline banner", () => {
  it("appears when the browser goes offline and leaves when it comes back", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await act(async () => root.render(<PwaStatus />));
    expect(container.querySelector(".offline-banner")).toBeNull();
    const setOnline = (value: boolean) =>
      Object.defineProperty(navigator, "onLine", { value, configurable: true });
    setOnline(false);
    await act(async () => void window.dispatchEvent(new Event("offline")));
    expect(container.querySelector(".offline-banner")?.getAttribute("role")).toBe("status");
    setOnline(true);
    await act(async () => void window.dispatchEvent(new Event("online")));
    expect(container.querySelector(".offline-banner")).toBeNull();
  });
});
