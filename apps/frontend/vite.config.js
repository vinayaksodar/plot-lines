import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: true, // expose on network (0.0.0.0)
    port: 5173, // or change if needed
    allowedHosts: true
  },
});
