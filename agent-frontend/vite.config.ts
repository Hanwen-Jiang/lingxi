import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {loadEnv} from "vite";
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

// Dev-only target for the /api proxy. Defaults to the chat gateway (D1 port
// 10010) because, per 03-contracts.md §6, that's the single front door — the
// gateway routes `/api/v1/**` to chat services, `/api/agent|memory|rag/**` to
// agent (:18080), and verifies JWT in one place.
//
// **Resolution order (P9):** `.env.local` / `.env.development.local` (Vite's
// gitignored local override) → `.env.development` → `.env` → `process.env`
// (the env field in a launcher config, if any) → built-in default. Switched
// from raw `process.env` lookup so a developer can pin the proxy target by
// dropping `VITE_API_PROXY_TARGET=http://127.0.0.1:10110` into `.env.local`
// without relying on the launcher to pipe env vars through (which several
// dev tooling shims dropped silently).
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, __dirname, "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:10010";

  return {
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
          // The chat gateway enforces a CORS allowlist via `allowedOriginPatterns`
          // (GateWay/application.yml default `http://localhost:[*]` — any localhost
          // port, but NOT raw 127.0.0.1). In dev the browser may load the SPA from
          // either hostname; either way we rewrite the forwarded Origin to one that
          // matches the allowlist so the gateway doesn't 403 the request before it
          // reaches a controller. Pre-P9 this stamped the upstream target as Origin
          // (works against legacy "trust your own origin" CORS) — P8 hardening
          // tightened the gateway to the localhost pattern, so we now stamp a
          // hostname the pattern actually accepts.
          //
          // We use `configure` over the bare `headers` option so the origin is
          // stamped at `proxyReq` time, after http-proxy-middleware has wired
          // the body pipe — slightly more robust than the `headers` shorthand
          // and easier to extend later (e.g. for debug logging on 5xx).
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.setHeader("origin", "http://localhost:5173");
            });
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: false,
    },
  };
});
