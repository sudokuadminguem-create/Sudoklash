import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^cloudflare:workers$/, replacement: path("./tests/support/workers.ts") },
      { find: /^@\/app\/supabase-auth$/, replacement: path("./tests/support/site-auth.ts") },
      { find: /^@\//, replacement: path("./") },
    ],
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
