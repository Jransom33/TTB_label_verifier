import path from "node:path";
import { defineConfig } from "vitest/config";

// Uncertain: native Vite config loading warned about CJS vs ESM for this file.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
  },
});
