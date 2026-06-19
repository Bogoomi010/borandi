import { defineConfig } from "vite";

// Tauri 개발 서버 권장 설정
export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.js"],
  },
} as never);
