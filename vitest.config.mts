import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Vitest configuration (Phase 1: unit tests, Node environment).
 * End-to-end browser tests are planned for a later phase so this
 * stays lightweight on limited-RAM machines.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-env.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
