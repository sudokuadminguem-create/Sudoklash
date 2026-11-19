import { defineConfig, devices } from "@playwright/test";

const port = 5173;
const baseURL = `http://localhost:${port}`;

// End-to-end tests drive the real app in a browser: `pnpm test:e2e`.
// They use the guest solo mode, which needs no account and no database.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  // The app follows the browser language: the suite is written against the French interface.
  use: { baseURL, locale: "fr-FR", trace: "retain-on-failure" },
  // CI runners have 4 cores: Playwright would only use 2 by default.
  workers: process.env.CI ? 4 : undefined,
  projects: [
    // mobile.spec.ts sets its own phone viewport and touch screen: no need to run it twice.
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: "mobile.spec.ts" },
    // On a phone, only the playing paths are replayed: pages, APIs, themes, languages and
    // accessibility do not depend on the device and are already covered on desktop.
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: ["mobile.spec.ts", "solo.spec.ts", "variants.spec.ts"],
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
