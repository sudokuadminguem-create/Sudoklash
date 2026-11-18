// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SupportPodium, SupportShop } from "@/app/_components/support";

vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({ Authorization: "x" }) }));
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
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

type Reply = (init?: RequestInit) => Response | Promise<Response>;
function stubFetch(routes: { availability?: Reply; post?: Reply; podium?: Reply }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/support") return routes.podium?.(init) ?? Response.json({ supporters: [] });
    if (init?.method === "POST") return routes.post?.(init) ?? new Response(null, { status: 500 });
    return routes.availability?.(init) ?? Response.json({ available: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const shop = (signedIn: boolean, openAuth = vi.fn()) =>
  act(async () => root.render(<SupportShop signedIn={signedIn} openAuth={openAuth} />));
const status = () =>
  [...container.querySelectorAll("[role='status']")].map((s) => s.textContent).join(" | ");

it("shows the podium of the biggest supporters", async () => {
  stubFetch({
    podium: () =>
      Response.json({
        supporters: [
          { place: 1, username: "Alice" },
          { place: 2, username: "Bob" },
        ],
      }),
  });
  await act(async () => root.render(<SupportPodium />));
  const places = [...container.querySelectorAll("li")].map((li) => li.textContent);
  expect(places).toEqual(["1er · OrAlice", "2e · ArgentBob"]);
});

it("hides an empty or unavailable podium", async () => {
  stubFetch({ podium: () => Promise.reject(new Error("offline")) });
  await act(async () => root.render(<SupportPodium />));
  expect(container.innerHTML).toBe("");
});

it("tells when donations are not enabled", async () => {
  stubFetch({ availability: () => Response.json({ available: false }) });
  await shop(true);
  expect(status()).toContain("pas encore activés");
});

it("treats an unreachable payment service as disabled", async () => {
  stubFetch({ availability: () => Promise.reject(new Error("offline")) });
  await shop(true);
  expect(status()).toContain("pas encore activés");
});

it("asks a guest to sign in", async () => {
  stubFetch({});
  const openAuth = vi.fn();
  await shop(false, openAuth);
  await act(async () => container.querySelector<HTMLButtonElement>(".primary")!.click());
  expect(openAuth).toHaveBeenCalledOnce();
});

it("needs consent, then opens Stripe Checkout", async () => {
  const post = vi.fn<Reply>(() =>
    Response.json({ url: "https://checkout.stripe.com/c/pay/cs_test_1" }),
  );
  const fetchMock = stubFetch({ post });
  await shop(true);
  const give = container.querySelector<HTMLButtonElement>(".support-options .primary")!;
  expect(give.disabled).toBe(true);
  await act(async () => container.querySelector<HTMLInputElement>("input")!.click());
  expect(give.disabled).toBe(false);
  // jsdom cannot navigate: only the request matters here.
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  await act(async () => give.click());
  errors.mockRestore();
  expect(post).toHaveBeenCalledOnce();
  const body = JSON.parse(String(fetchMock.mock.calls.at(-1)![1]!.body)) as {
    publishSupport: boolean;
  };
  expect(body.publishSupport).toBe(true);
  expect(status()).not.toContain("Impossible");
});

it("refuses a checkout URL outside Stripe and a failed checkout", async () => {
  let reply: Reply = () => Response.json({ url: "https://evil.example/pay" });
  stubFetch({ post: (init) => reply(init) });
  await shop(true);
  await act(async () => container.querySelector<HTMLInputElement>("input")!.click());
  const give = () => container.querySelector<HTMLButtonElement>(".support-options .primary")!;
  await act(async () => give().click());
  expect(status()).toContain("Impossible d’ouvrir le paiement");
  reply = () => new Response(null, { status: 409 });
  await act(async () => give().click());
  expect(status()).toContain("Impossible d’ouvrir le paiement");
});

it("confirms a donation on the way back from Stripe", async () => {
  window.history.replaceState(null, "", "/?support_session=cs_test_1");
  const post = vi.fn<Reply>(() => Response.json({ ok: true }));
  stubFetch({ post });
  await shop(true);
  expect(status()).toContain("Merci pour ton soutien");
  expect(location.search).toBe("");
});

it("says when a donation could not be confirmed yet, or was cancelled", async () => {
  window.history.replaceState(null, "", "/?support_session=cs_test_1&support_cancelled=1");
  stubFetch({ post: () => new Response(null, { status: 409 }) });
  await shop(true);
  expect(status()).toContain("pas encore pu être confirmé");
});

it("shows a cancelled payment", async () => {
  window.history.replaceState(null, "", "/?support_cancelled=1");
  stubFetch({});
  await shop(false);
  expect(status()).toContain("Paiement annulé.");
});
