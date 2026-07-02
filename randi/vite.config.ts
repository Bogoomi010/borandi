import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5183, host: true },
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
});
