import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point Empirica imports to stubs so vitest can resolve them.
      // vi.mock() in tests overrides these stubs with full mocks.
      "@empirica-core/player/classic/react": path.resolve(__dirname, "client/__tests__/empiricaStub.js"),
      "@empirica-core/player/classic":       path.resolve(__dirname, "client/__tests__/empiricaStub.js"),
      "@empirica-core/player":               path.resolve(__dirname, "client/__tests__/empiricaStub.js"),
      "@empirica-core/admin/classic":        path.resolve(__dirname, "client/__tests__/empiricaStub.js"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./client/__tests__/setup.js"],
  },
});
