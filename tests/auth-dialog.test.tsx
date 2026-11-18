// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthDialog } from "@/app/_components/auth-dialog";
import type { Account } from "@/hooks/use-account";

const auth = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}));
vi.mock("@/app/lib/supabase", () => ({ supabase: { auth } }));
vi.mock("@/app/lib/auth-headers", () => ({ authHeaders: async () => ({}) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement, root: Root;
beforeEach(() => {
  for (const fn of Object.values(auth)) fn.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const guest = { user: null, profile: null, refresh: vi.fn() } as unknown as Account;
const render = (props: Partial<Parameters<typeof AuthDialog>[0]> = {}) =>
  act(async () => root.render(<AuthDialog account={guest} onClose={vi.fn()} {...props} />));
const title = () => container.querySelector("h2")!.textContent;
const button = (text: string) =>
  [...container.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === text,
  )!;
const click = (element: HTMLElement) => act(async () => element.click());
async function type(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const message = () => container.querySelector(".form-error, .form-info")?.textContent ?? "";

it("signs in with an e-mail and a password", async () => {
  auth.signInWithPassword.mockResolvedValue({ data: { session: {} }, error: null });
  await render();
  const dialog = container.querySelector("dialog.account-dialog")!;
  expect(dialog.hasAttribute("open")).toBe(true);
  expect(dialog.getAttribute("aria-labelledby")).toBe("account-title");
  expect(title()).toBe("Se connecter");
  expect(container.querySelector("small")?.textContent).toContain("Tu resteras connecté");
  const submit = button("Se connecter");
  expect(submit.disabled).toBe(true);
  await type("input[type='email']", " alice@example.fr ");
  await type(".password-field input", "secret123");
  expect(submit.disabled).toBe(false);
  await click(button("Se connecter"));
  expect(auth.signInWithPassword).toHaveBeenCalledWith({
    email: "alice@example.fr",
    password: "secret123",
  });
  await click(container.querySelector<HTMLButtonElement>(".password-field button")!);
  expect(container.querySelector<HTMLInputElement>(".password-field input")!.type).toBe("text");
});

it("creates an account and asks to confirm the e-mail", async () => {
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await render({ startSignup: true });
  expect(title()).toBe("Créer un compte");
  expect(container.querySelector(".signup-benefits")).not.toBeNull();
  await type("input[type='email']", "bob@example.fr");
  await type(".password-field input", "secret123");
  await click(button("Créer mon compte"));
  expect(auth.signUp).toHaveBeenCalledOnce();
  expect(message()).toContain("Compte créé");
  await click(button("J’ai déjà un compte"));
  expect(title()).toBe("Se connecter");
  await click(button("Créer un compte gratuitement"));
  expect(title()).toBe("Créer un compte");
});

it("shows a sign-in failure", async () => {
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error("boom") });
  await render();
  await type("input[type='email']", "alice@example.fr");
  await type(".password-field input", "secret123");
  await click(button("Se connecter"));
  expect(container.querySelector(".form-error")).not.toBeNull();
});

it("sends a reset link from the forgotten password form", async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  await render();
  await click(button("Mot de passe oublié ?"));
  expect(title()).toBe("Mot de passe oublié");
  const send = button("Envoyer le lien");
  expect(send.disabled).toBe(true);
  await type("input[type='email']", "alice@example.fr");
  await click(button("Envoyer le lien"));
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("alice@example.fr", {
    redirectTo: `${location.origin}/?reset=1`,
  });
  expect(message()).toContain("Si cette adresse correspond à un compte");
  await click(button("Retour à la connexion"));
  expect(title()).toBe("Se connecter");
});

it("checks the recovery link before offering a new password", async () => {
  await render({ recovery: true });
  expect(title()).toBe("Nouveau mot de passe");
  expect(container.textContent).toContain("Vérification du lien de récupération");
});

it("sends an expired recovery link back to the forgotten password form", async () => {
  await render({ recovery: true, recoveryStatus: "expired" });
  expect(container.textContent).toContain("Ce lien a expiré");
  await click(button("Demander un nouveau lien"));
  expect(title()).toBe("Mot de passe oublié");
});

it("saves a new password from a valid recovery link", async () => {
  auth.getSession.mockResolvedValue({ data: { session: {} }, error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  const onRecovered = vi.fn();
  await render({ recovery: true, recoveryStatus: "ready", onRecovered });
  await type(".password-field input", "newsecret1");
  await click(button("Enregistrer le mot de passe"));
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "newsecret1" });
  expect(onRecovered).toHaveBeenCalledOnce();
  expect(message()).toContain("Mot de passe modifié");
});

it("refuses a new password without a recovery session", async () => {
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  await render({ recovery: true, recoveryStatus: "ready" });
  await type(".password-field input", "newsecret1");
  await click(button("Enregistrer le mot de passe"));
  expect(auth.updateUser).not.toHaveBeenCalled();
  expect(container.querySelector(".form-error")).not.toBeNull();
});

it("asks a signed-in player without a username to choose one", async () => {
  const refresh = vi.fn(async () => {});
  const onClose = vi.fn();
  const fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  const account = { user: { id: "alice" }, profile: null, refresh } as unknown as Account;
  await render({ account, onClose });
  expect(title()).toBe("Choisissez votre pseudo");
  expect(document.activeElement).toBe(container.querySelector("input"));
  await type("input", "LogikRush");
  await click(button("Valider mon pseudo"));
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/profile",
    expect.objectContaining({ method: "POST" }),
  );
  expect(refresh).toHaveBeenCalledOnce();
  expect(onClose).toHaveBeenCalledOnce();
});

it("shows why a username was refused", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "username_taken" }, { status: 409 })),
  );
  const account = { user: { id: "alice" }, profile: null, refresh: vi.fn() } as unknown as Account;
  await render({ account });
  await type("input", "LogikRush");
  await click(button("Valider mon pseudo"));
  expect(container.querySelector(".form-error")).not.toBeNull();
});
