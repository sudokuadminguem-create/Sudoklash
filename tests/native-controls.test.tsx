// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AchievementBoard } from "@/app/_components/achievement-board";
import { SettingsPanel } from "@/app/_components/settings-panel";
import MajesticCollection from "@/app/admin/majestic-collection";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { SettingsProvider } from "@/app/lib/settings";
import type { Account, AccountState } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
import { achievementFrames } from "@/lib/achievement-frames";

const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/app/lib/supabase", () => ({ supabase: { auth: { signOut } } }));
vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/_components/player-cosmetics", () => ({ PlayerAvatar: () => null }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  signOut.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const render = (node: React.ReactNode) => act(async () => root.render(node));
const click = (element: HTMLElement) => act(async () => element.click());

it("filters the achievements by rarity in a fieldset", async () => {
  const achievements = achievementFrames
    .filter((a) => a.rarity !== "majestic")
    .map((a, i) => ({ ...a, progress: 0, unlocked: i % 3 === 0 }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ achievements, visibleTotal: 100, secretUnlocked: 0, newlyUnlocked: [] }),
    ),
  );
  await render(
    <AchievementBoard
      account={{ user: { id: "alice" } } as AccountState}
      cosmetics={{ action: vi.fn() } as unknown as Cosmetics}
      openAuth={vi.fn()}
      notify={vi.fn()}
    />,
  );
  const filters = container.querySelector<HTMLFieldSetElement>("fieldset.challenge-categories")!;
  expect(filters.getAttribute("aria-label")).toBe("Filtrer les défis par rareté");
  const epic = [...filters.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    b.className.startsWith("epic"),
  )!;
  await click(epic);
  expect(epic.getAttribute("aria-pressed")).toBe("true");
  const done = [...container.querySelectorAll<HTMLButtonElement>(".challenge-tabs button")][1];
  await click(done);
  expect(filters.querySelector(".active small")?.textContent).toBe(
    String(achievements.filter((a) => a.unlocked && a.rarity === "epic").length),
  );
});

it("shows the progress of each majestic frame with a native progress bar", async () => {
  const [first, second] = achievementFrames.filter((a) => a.rarity === "majestic");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        achievements: [
          { ...first, progress: first.target * 2, unlocked: true },
          { ...second, progress: 1, unlocked: false },
        ],
      }),
    ),
  );
  await render(<MajesticCollection />);
  const bars = [...container.querySelectorAll<HTMLProgressElement>("progress")];
  expect(bars.map((bar) => [bar.max, bar.value])).toEqual([
    [first.target, first.target],
    [second.target, 1],
  ]);
  expect(bars[0].getAttribute("aria-label")).toBe(`Progression : ${first.name}`);
});

it("tells when the majestic frames cannot be loaded", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 503 })),
  );
  await render(<MajesticCollection />);
  expect(container.querySelector("progress")).toBeNull();
  expect(container.textContent).not.toBe("");
});

it("focuses the input when its addon is clicked, but not from an addon button", async () => {
  await render(
    <InputGroup>
      <InputGroupInput aria-label="Recherche" />
      <InputGroupAddon>
        <span>icône</span>
        <button type="button">effacer</button>
      </InputGroupAddon>
    </InputGroup>,
  );
  const input = container.querySelector("input")!;
  const addon = container.querySelector<HTMLElement>("[data-slot='input-group-addon']")!;
  expect(addon.getAttribute("role")).toBeNull();
  await click(addon.querySelector("button")!);
  expect(document.activeElement).not.toBe(input);
  await click(addon.querySelector("span")!);
  expect(document.activeElement).toBe(input);
});

it("signs out from the settings, and says when it failed", async () => {
  const notify = vi.fn();
  let finish!: (value: { error: Error | null }) => void;
  signOut.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
  await render(
    <SettingsProvider>
      <SettingsPanel notify={notify} account={{ user: { id: "alice" } } as Account} />
    </SettingsProvider>,
  );
  const button = container.querySelector<HTMLButtonElement>(".settings-group .primary")!;
  expect(button.textContent).toBe("Déconnexion");
  await click(button);
  expect(button.textContent).toBe("Déconnexion…");
  expect(button.disabled).toBe(true);
  await act(async () => finish({ error: null }));
  expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(notify).toHaveBeenLastCalledWith("Tu es déconnecté.");
  expect(button.textContent).toBe("Déconnexion");
  signOut.mockResolvedValue({ error: new Error("offline") });
  await click(button);
  expect(notify).toHaveBeenCalledTimes(2);
  expect(notify.mock.calls[1][0]).not.toBe("Tu es déconnecté.");
});

it("names each settings switch after its setting", async () => {
  await render(
    <SettingsProvider>
      <SettingsPanel notify={vi.fn()} />
    </SettingsProvider>,
  );
  const rows = [...container.querySelectorAll<HTMLLabelElement>("label.setting-row")];
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows)
    expect(row.getAttribute("aria-label")).toBe(row.querySelector("b")!.textContent);
});
