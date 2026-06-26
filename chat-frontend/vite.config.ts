import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Dev proxy points the IM REST routes at the local GateWay (Spring Cloud Gateway).
// When VITE_API_BASE is set the app talks to a real backend; otherwise it runs on the mock layer.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_GATEWAY ?? "http://127.0.0.1:8080",
        changeOrigin: true,
      },
    },
  },
});
