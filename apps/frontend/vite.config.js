import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  server: {
    host: true, // expose on network (0.0.0.0)
    port: 5173, // or change if needed
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@plot-lines/editor": path.resolve(__dirname, "../../packages/editor/src/index.js"),
    },
  },
});
