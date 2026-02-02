import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    host: true, // expose on network (0.0.0.0)
    port: 5173, // or change if needed
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
    sourcemapIgnoreList: false, // 👈 ensures Vite doesn’t skip deps in DevTools
  },
  build: {
    sourcemap: true, // 👈 generate sourcemaps
  },
  resolve: {
    preserveSymlinks: true, // 👈 important for Turborepo + local packages
    alias: {
      "@plot-lines/editor": path.resolve(
        __dirname,
        "../../packages/editor/src/index.js",
      ),
    },
  },
});
