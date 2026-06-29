import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 개발 서버 권장 설정
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.js"],
  },
} as never);
