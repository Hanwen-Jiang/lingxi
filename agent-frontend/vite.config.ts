import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vitest/config";

// Minimal Node global typing so the config type-checks without @types/node.
declare const process: {env: Record<string, string | undefined>};

// Dev-only target for the /api proxy. Defaults to the agent backend's D1 port
// (18080). Override with VITE_API_PROXY_TARGET when the agent runs elsewhere
// (e.g. http://127.0.0.1:10010 for the legacy port, or the unified gateway).
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:18080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
