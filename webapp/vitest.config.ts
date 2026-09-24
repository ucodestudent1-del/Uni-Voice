import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    setupFiles: ["src/__tests__/setup.ts"],
  },
});
