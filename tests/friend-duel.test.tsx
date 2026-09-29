// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FriendDuel, type DuelState, type DuelView } from "@/app/_components/friend-duel";
import type { Account } from "@/hooks/use-account";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const account = (signedIn = true) =>
  ({
    user: signedIn ? { id: "alice" } : null,
    profile: { username: "Alice" },
    loading: false,
  }) as unknown as Account;

const emptyState: DuelState = { incoming: [], outgoing: null, duel: null };
const puzzle = "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const playing = (extra: Partial<DuelView> = {}): DuelView => ({
  id: "d1",
  status: "playing",
  difficulty: "Facile",
  puzzle,
  startedAt: Date.now(),
  finishedAt: null,
  winnerId: null,
  finishReason: null,
  opponent: { id: "bob", username: "Bob" },
  myFilled: 0,
  opponentFilled: 4,
  totalToFill: 51,
  mistakes: 0,
  durationSeconds: null,
  record: { wins: 1, losses: 2 },
  ...extra,
});

type Call = { method: string; url: string; body?: Record<string, unknown> };
let root: Root, container: HTMLDivElement;
let calls: Call[];
let state: DuelState;
let reply: (call: Call) => { status?: number; body: unknown } | undefined;
const friends = [
  { status: "accepted", otherUserId: "bob", username: "Bob" },
  { status: "accepted", otherUserId: "carol", username: "Carol" },
  { status: "pending", otherUserId: "dave", username: "Dave" },
];

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"],
  });
  vi.setSystemTime(new Date("2026-09-26T10:00:00Z"));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  calls = [];
  state = emptyState;
  reply = () => undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call: Call = {
        method: init?.method ?? "GET",
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(call);
      const custom = reply(call);
      const payload = custom
        ? custom
        : url.startsWith("/api/friends")
          ? { body: { relationships: friends } }
          : call.method === "GET"
            ? { body: state }
            : { body: { ok: true } };
      return new Response(JSON.stringify(payload.body), { status: payload.status ?? 200 });
    }),
  );
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const text = () => container.textContent ?? "";
const button = (label: string | RegExp) =>
  [...container.querySelectorAll("button")].find((b) =>
    typeof label === "string" ? b.textContent?.trim() === label : label.test(b.textContent ?? ""),
  ) as HTMLButtonElement;
const posts = () => calls.filter((c) => c.method === "POST").map((c) => c.body);
const tick = (ms = 0) => act(async () => vi.advanceTimersByTimeAsync(ms));

async function render(props: Partial<Parameters<typeof FriendDuel>[0]> = {}) {
  await act(async () =>
    root.render(
      <FriendDuel account={account()} openAuth={() => {}} notify={() => {}} {...props} />,
    ),
  );
  await tick(10);
}

describe("friend duels", () => {
  it("asks to sign in", async () => {
    await render({ account: account(false) });
    expect(text()).toContain("Défie tes amis");
    expect(calls).toHaveLength(0);
  });

  it("lists only accepted friends", async () => {
    await render();
    const names = [...container.querySelectorAll(".duel-friend b")].map((n) => n.textContent);
    expect(names).toEqual(["Bob", "Carol"]);
  });

  it("challenges a friend at the chosen difficulty", async () => {
    const notify = vi.fn();
    await render({ notify });
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".duel-friend button")[0].click(),
    );
    expect(text()).toContain("Défier Bob");
    const levels = [...container.querySelectorAll(".duel-levels button")].map((b) => b.textContent);
    expect(levels).toEqual(["Facile", "Intermédiaire", "Difficile", "Expert"]);
    expect(container.querySelector('.duel-levels [aria-checked="true"]')!.textContent).toBe(
      "Intermédiaire",
    );
    await act(async () => button("Difficile").click());
    await act(async () => button("Envoyer le défi").click());
    expect(posts()).toEqual([{ action: "challenge", friendId: "bob", difficulty: "Difficile" }]);
    expect(notify).toHaveBeenCalledWith("Défi envoyé à Bob");
  });

  it("opens the challenge of a friend picked in the friends list", async () => {
    const onTargetUsed = vi.fn();
    await render({ target: { id: "carol", username: "Carol" }, onTargetUsed });
    expect(text()).toContain("Défier Carol");
    expect(onTargetUsed).toHaveBeenCalledTimes(1);
  });

  it("shows a waiting challenge, which can be cancelled", async () => {
    state = {
      ...emptyState,
      outgoing: { id: "d9", to: { id: "bob", username: "Bob" }, difficulty: "Facile" },
    };
    await render();
    expect(text()).toContain("En attente de Bob");
    expect(container.querySelector(".duel-friends")).toBeNull();
    await act(async () => button("Annuler").click());
    expect(posts()).toEqual([{ action: "cancel", id: "d9" }]);
  });

  it("shows challenges received and answers them", async () => {
    state = {
      ...emptyState,
      incoming: [
        { id: "i1", from: { id: "bob", username: "Bob" }, difficulty: "Expert" },
        { id: "i2", from: { id: "carol", username: "Carol" }, difficulty: "Facile" },
      ],
    };
    await render();
    expect(text()).toContain("Bob te défie !");
    expect(text()).toContain("Carol te défie !");
    // Challenging someone else waits until these are answered.
    expect(container.querySelector<HTMLButtonElement>(".duel-friend button")!.disabled).toBe(true);
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".duel-card.incoming .primary")[0].click(),
    );
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".duel-card.incoming .subtle")[1].click(),
    );
    expect(posts()).toEqual([
      { action: "accept", id: "i1" },
      { action: "decline", id: "i2" },
    ]);
  });

  it("explains why a challenge was refused", async () => {
    reply = (call) =>
      call.method === "POST" ? { status: 409, body: { error: "busy" } } : undefined;
    await render();
    await act(async () =>
      container.querySelectorAll<HTMLButtonElement>(".duel-friend button")[0].click(),
    );
    await act(async () => button("Envoyer le défi").click());
    expect(container.querySelector(".form-error")!.textContent).toContain("déjà un duel en cours");
  });

  it("polls faster during a game and plays it against the server", async () => {
    state = { ...emptyState, duel: playing() };
    reply = (call) =>
      call.body?.action === "check" ? { body: { correct: true, mistakes: 0 } } : undefined;
    await render();
    expect(container.querySelector(".sudoku")).not.toBeNull();
    expect(text()).toContain("Duel contre Bob");
    expect(text()).toContain("Bilan : 1 – 2");
    // Not a ranked game: the board says so.
    expect(container.querySelector(".eyebrow")!.textContent).toBe("DUEL ENTRE AMIS · FACILE");
    const race = container.querySelector(".opponents")!;
    expect(race.textContent).toContain("Bob");
    expect(race.textContent).toContain("4/51");

    const before = calls.filter((c) => c.method === "GET" && c.url === "/api/duels").length;
    await tick(3100);
    const during =
      calls.filter((c) => c.method === "GET" && c.url === "/api/duels").length - before;
    expect(during).toBeGreaterThanOrEqual(2); // every 1.5 s, not every 3 s

    const cells = [...container.querySelectorAll<HTMLButtonElement>(".sudoku button")];
    const empty = cells.findIndex((_, i) => puzzle[i] === "0");
    await act(async () => cells[empty].click());
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "4" }));
    });
    await tick(10);
    const check = posts().find((body) => body?.action === "check")!;
    expect(check).toMatchObject({ action: "check", index: empty, number: 4 });
    expect(String(check.mistakeId)).toMatch(/^[a-f0-9-]{36}$/);
    expect(check).not.toHaveProperty("grid");
  });

  it("asks before giving up", async () => {
    state = { ...emptyState, duel: playing() };
    await render();
    await act(async () => button("Abandonner").click());
    expect(posts().some((body) => body?.action === "forfeit")).toBe(false);
    await act(async () => button("Continuer").click());
    expect(container.querySelector(".duel-confirm")).toBeNull();
    await act(async () => button("Abandonner").click());
    await act(async () =>
      container.querySelector<HTMLButtonElement>(".duel-confirm .ranked-forfeit")!.click(),
    );
    expect(posts().some((body) => body?.action === "forfeit")).toBe(true);
  });

  it("sums a won duel up and offers a rematch at the same difficulty", async () => {
    state = {
      ...emptyState,
      duel: playing({
        status: "finished",
        winnerId: "alice",
        finishReason: "completed",
        durationSeconds: 245,
        myFilled: 51,
        record: { wins: 2, losses: 2 },
      }),
    };
    await render();
    expect(text()).toContain("Victoire !");
    expect(text()).toContain("Grille terminée la première");
    expect(text()).toContain("04:05");
    expect(text()).toContain("2 – 2");
    await act(async () => button("Revanche").click());
    await tick(10);
    expect(posts()).toEqual([
      { action: "dismiss", id: "d1" },
      { action: "challenge", friendId: "bob", difficulty: "Facile" },
    ]);
  });

  it("says why a lost duel ended, and closes it", async () => {
    state = {
      ...emptyState,
      duel: playing({
        status: "finished",
        winnerId: "bob",
        finishReason: "three_mistakes",
        durationSeconds: 60,
      }),
    };
    await render();
    expect(text()).toContain("Défaite");
    expect(text()).toContain("Fin après trois erreurs");
    await act(async () => button("Fermer").click());
    expect(posts()).toEqual([{ action: "dismiss", id: "d1" }]);
  });

  it("explains a forfeit from either side", async () => {
    state = {
      ...emptyState,
      duel: playing({
        status: "finished",
        winnerId: "alice",
        finishReason: "forfeit",
        durationSeconds: 5,
      }),
    };
    await render();
    expect(text()).toContain("Bob a abandonné");
  });
});
