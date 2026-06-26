import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import {defineConfig} from "vite";

// Minimal Node global typing so the config type-checks without @types/node.
declare const process: {env: Record<string, string | undefined>};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
});
