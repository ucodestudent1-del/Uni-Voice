import { defineConfig } from "vitest/config";

// Ensure DB/config resolves to the test database for any test that touches it.
process.env.APP_ENV = "test";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    globalSetup: "./tests/global-setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain/**/*.ts"],
      exclude: ["src/domain/value-objects/**/*.ts"],
    },
  },
});