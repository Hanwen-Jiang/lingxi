import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

const root = dirname(fileURLToPath(import.meta.url));

// Real data goes through the chat Spring Cloud Gateway (D1: :10010, /api/v1).
// VITE_API_BASE overrides; default empty = Mock mode. VITE_GATEWAY targets a
// non-default gateway (e.g. the E2E segment :10110).
//
// @infinitechat/design-system is a root workspace package (../packages/...).
// It's a real npm-managed workspace dep (so S2 can consume it the standard way);
// the alias just pins Vite to its TS source for reliable monorepo resolution.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@infinitechat/design-system": resolve(root, "../packages/design-system/src/index.ts"),
      "@": resolve(root, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port: process.env.PORT ? Number(process.env.PORT) : 5273,
    proxy: {
      "/api": {
        target: process.env.VITE_GATEWAY ?? "http://127.0.0.1:10010",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
