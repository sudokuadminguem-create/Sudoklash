import { expect, test } from "@playwright/test";

test("the health check answers", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBe(true);
});

test("the home page loads without errors in the console", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choisis ta difficulté" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("anonymous visitors are told to sign in on protected APIs", async ({ request }) => {
  for (const path of ["/api/account", "/api/cosmetics", "/api/friends", "/api/duels"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
});

test("the admin API pretends not to exist", async ({ request }) => {
  expect((await request.get("/api/admin/challenges")).status()).toBe(404);
});

test("the duel tab asks a visitor to sign in", async ({ page }) => {
  const hydrated = page.waitForResponse((response) => response.url().endsWith("/api/me"));
  await page.goto("/");
  await hydrated;
  await page.getByRole("button", { name: /Duel d’amis/ }).click();
  await expect(page.getByRole("heading", { name: "Défie tes amis" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Se connecter ou créer un compte/ })).toBeVisible();
});
