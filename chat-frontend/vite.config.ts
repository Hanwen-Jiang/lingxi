import {dirname, resolve} from "node:path";
import {fileURLToPath} from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig, loadEnv} from "vite";

const root = dirname(fileURLToPath(import.meta.url));

// Real data goes through the chat Spring Cloud Gateway (D1: :10010, /api/v1).
// VITE_API_BASE selects the real branch (empty = Mock); set it to "1" to use this
// dev proxy (no CORS) or to an absolute gateway URL to call it directly.
// VITE_GATEWAY targets a non-default gateway (e.g. the E2E segment :10110) and is
// read from .env* via loadEnv (the proxy runs in Node, so import.meta.env doesn't
// reach it — loadEnv does), so `VITE_GATEWAY=…` in .env.local just works.
//
// @infinitechat/design-system is a root workspace package (../packages/...).
// It's a real npm-managed workspace dep (so S2 can consume it the standard way);
// the alias just pins Vite to its TS source for reliable monorepo resolution.
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, root, "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@infinitechat/design-system": resolve(root, "../packages/design-system/src/index.ts"),
        "@": resolve(root, "src"),
      },
      // The design-system is a symlinked workspace package that imports HeroUI /
      // react-aria; dedupe forces a single React instance (else "invalid hook call").
      dedupe: ["react", "react-dom"],
    },
    server: {
      host: "127.0.0.1",
      port: env.PORT ? Number(env.PORT) : 5273,
      proxy: {
        "/api": {
          target: env.VITE_GATEWAY || "http://127.0.0.1:10010",
          changeOrigin: true,
          ws: true,
          configure: (proxy) => {
            // The gateway 403s cross-origin POSTs (a CSRF/CORS policy on the auth
            // endpoints). `changeOrigin` only rewrites Host, not Origin — so the
            // browser's dev Origin still trips it. Strip Origin to emulate
            // same-origin locally; prod serves the SPA from an allowed origin
            // (or the gateway runs real CORS), so this is dev-only plumbing.
            proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
          },
        },
      },
    },
  };
});
