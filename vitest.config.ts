import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: ".vitest-cache",
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", "work/**", "out/**", ".next/**"]
  }
});
