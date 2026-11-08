import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  cacheDir: ".vitest-cache",
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "work/**", "out/**", ".next/**"]
  }
});
