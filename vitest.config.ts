import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // tsconfig keeps JSX for Next.js; tests compile it with the automatic React runtime.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: [
      { find: /^cloudflare:workers$/, replacement: path("./tests/support/workers.ts") },
      { find: /^@\/app\/supabase-auth$/, replacement: path("./tests/support/site-auth.ts") },
      { find: /^@\//, replacement: path("./") },
    ],
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    // Coverage instrumentation slows the puzzle generator tests down a lot.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // Application logic and API routes; generated UI kit and pages are left out.
      include: ["app/api/**", "app/lib/**", "lib/**", "app/_components/**"],
      exclude: ["lib/puzzle-bank.ts", "lib/runtime/**"],
      reporter: ["text-summary", "json-summary", "lcovonly"],
      // A floor just under today's numbers: coverage may go up, not quietly back down.
      thresholds: { statements: 40, branches: 30, functions: 38, lines: 40 },
    },
  },
});
