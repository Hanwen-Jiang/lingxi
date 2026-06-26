import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vitest/config";

// Minimal Node global typing so the config type-checks without @types/node.
declare const process: {env: Record<string, string | undefined>};
declare const __dirname: string;

// Resolve a sibling-package source path. The shared design system lives at the
// repo-root `packages/design-system/` (owned by S4, D8; promoted to a root
// workspace package in P1). We consume it via a Vite alias instead of npm
// workspaces to avoid the npm-cache EPERM/relink race that bit S4. The matching
// TS path lives in tsconfig.json. Vite 5 resolves the config file's __dirname at
// load time, so we can use a plain relative join without importing node:path.
const designSystemRoot = `${__dirname.replace(/\\/g, "/")}/../packages/design-system`;

// Dev-only target for the /api proxy. Defaults to the agent backend's D1 port
// (18080). Override with VITE_API_PROXY_TARGET when the agent runs elsewhere
// (e.g. http://127.0.0.1:10010 for the legacy port, or the unified gateway).
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:18080";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@infinitechat/design-system": `${designSystemRoot}/src/index.ts`,
      "@infinitechat/design-system/styles/tokens.css": `${designSystemRoot}/src/styles/tokens.css`,
    },
  },
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
