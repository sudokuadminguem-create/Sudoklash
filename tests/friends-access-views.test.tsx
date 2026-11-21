// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/hooks/use-account";
import FriendsDirectory from "@/app/_components/friends-directory";
import AdminAccess from "@/app/admin/access";
import { mount, replyWith, settle } from "./support/render";

const accountState = vi.hoisted(() => ({ value: { loading: false, user: null } as object }));
vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/lib/supabase", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("@/hooks/use-account", () => ({ useAccount: () => accountState.value }));
vi.mock("@/app/_components/auth-dialog", () => ({ AuthDialog: () => null }));
vi.mock("@/app/admin/panel", () => ({
  default: ({ displayName }: { displayName: string }) => <p>Panneau de {displayName}</p>,
}));

let view: Awaited<ReturnType<typeof mount>> | undefined;
afterEach(async () => {
  await view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
});

describe("Friends directory", () => {
  const me = "me";
  const player = (id: string) => ({
    id,
    username: id,
    avatarId: "cat",
    frameId: "starter",
    image: null,
  });
  const relation = (other: string, status: string, requester: string) => ({
    id: `r-${other}`,
    requester_id: requester,
    addressee_id: requester === me ? other : me,
    status,
    username: other,
    otherUserId: other,
    avatarId: "cat",
    frameId: "starter",
    image: null,
  });
  const listing = {
    players: ["stranger", "friend", "asked", "asking"].map(player),
    nextOffset: null,
    relationships: [
      relation("friend", "accepted", me),
      relation("asked", "pending", me),
      relation("asking", "pending", "asking"),
    ],
  };

  async function render() {
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? replyWith({ ok: true })() : replyWith(listing)(),
    );
    vi.stubGlobal("fetch", fetch);
    const notify = vi.fn();
    view = await mount(
      <FriendsDirectory account={{ user: { id: me } } as unknown as Account} notify={notify} />,
    );
    return notify;
  }
  const row = (name: string) =>
    [...view!.container.querySelectorAll(".player-entry")].find(
      (el) => el.querySelector("b")?.textContent === name,
    )!;

  it("describes the relation with each player", async () => {
    await render();
    expect(row("stranger").querySelector("small")?.textContent).toBe("Joueur Sudoklash");
    expect(row("friend").querySelector("small")?.textContent).toBe("Déjà ami");
    expect(row("asked").querySelector("small")?.textContent).toBe("Demande envoyée");
    expect(row("asking").querySelector("small")?.textContent).toBe("Vous a envoyé une demande");
  });

  it("confirms a sent request and an accepted one", async () => {
    const notify = await render();
    await act(async () => row("stranger").querySelector("button")!.click());
    await settle();
    expect(notify).toHaveBeenLastCalledWith("Demande d’ami envoyée");
    await act(async () => row("asking").querySelector("button")!.click());
    await settle();
    expect(notify).toHaveBeenLastCalledWith("Ami ajouté");
  });
});

describe("Admin access", () => {
  const render = async (account: object, me: object) => {
    accountState.value = account;
    vi.stubGlobal("fetch", vi.fn(replyWith(me)));
    view = await mount(<AdminAccess />);
    return view.container.textContent ?? "";
  };
  const notAdmin = { isAdmin: false, displayName: null };

  it("checks the account while it loads", async () => {
    expect(await render({ loading: true, user: null }, notAdmin)).toContain(
      "Vérification de votre compte…",
    );
  });

  it("asks a guest to sign in", async () => {
    expect(await render({ loading: false, user: null }, notAdmin)).toContain("Se connecter");
  });

  it("offers to switch a signed-in account without the rights", async () => {
    const text = await render({ loading: false, user: { id: "u1" } }, notAdmin);
    expect(text).toContain("ne dispose pas des droits");
    expect(text).toContain("Changer de compte");
  });

  it("opens the panel for the owner", async () => {
    expect(
      await render({ loading: false, user: { id: "u1" } }, { isAdmin: true, displayName: "Ana" }),
    ).toContain("Panneau de Ana");
  });
});
