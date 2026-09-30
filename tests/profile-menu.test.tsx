// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AccountButton } from "@/app/_components/account-button";
import type { Account } from "@/hooks/use-account";
import type { Cosmetics } from "@/hooks/use-cosmetics";
vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
vi.mock("@/app/lib/use-player-appearances", () => ({ usePlayerAppearances: () => ({}) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.unstubAllGlobals());
it("lists incoming invitations and opens the matching screen or photo editor", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url === "/api/friends"
          ? {
              relationships: [
                {
                  id: "in",
                  otherUserId: "bob",
                  username: "Bob",
                  status: "pending",
                  addressee_id: "alice",
                },
                {
                  id: "out",
                  otherUserId: "eve",
                  username: "Eve",
                  status: "pending",
                  addressee_id: "eve",
                },
              ],
            }
          : { incoming: [{ id: "duel", from: { id: "carol", username: "Carol" } }] },
      ),
    ),
  );
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const friends = vi.fn(),
    duels = vi.fn(),
    account = vi.fn(),
    photo = vi.fn();
  await act(async () =>
    root.render(
      <AccountButton
        account={{ loading: false, user: { id: "alice" } } as Account}
        cosmetics={{ state: { level: 2 } } as Cosmetics}
        onOpen={() => {}}
        onAccount={account}
        onFriends={friends}
        onDuels={duels}
        onEditPhoto={photo}
      />,
    ),
  );
  const popup = container.querySelector<HTMLDivElement>("[popover]")!;
  popup.hidePopover = vi.fn();
  expect(container.querySelector(".profile-notice-count")?.textContent).toBe("2");
  expect(popup.textContent).not.toContain("Eve");
  const buttons = [...popup.querySelectorAll<HTMLButtonElement>("button")];
  await act(async () => buttons.find((button) => button.textContent?.includes("Bob"))!.click());
  await act(async () => buttons.find((button) => button.textContent?.includes("Carol"))!.click());
  await act(async () => container.querySelector<HTMLButtonElement>(".profile-photo-edit")!.click());
  expect(friends).toHaveBeenCalledOnce();
  expect(duels).toHaveBeenCalledOnce();
  expect(photo).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
  container.remove();
});
