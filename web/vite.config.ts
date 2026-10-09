import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const shared = fileURLToPath(new URL("../shared/index.ts", import.meta.url));
const apiTarget = process.env.API_URL ?? "http://localhost:4000";

// GitHub Pages'te /<repo>/ altinda yayinlanir; yerel gelistirmede "/".
const base = process.env.VITE_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@ih/shared": shared,
    },
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    strictPort: false,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false },
      "/auth": { target: apiTarget, changeOrigin: false },
      "/socket.io": { target: apiTarget, changeOrigin: false, ws: true },
    },
  },
  preview: {
    port: Number(process.env.WEB_PORT ?? 5173),
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
