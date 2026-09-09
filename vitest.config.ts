import { defineConfig } from "vitest/config";

// Ensure DB/config resolves to the test database for any test that touches it.
process.env.APP_ENV = "test";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    // The DB-backed test suite shares a single PostgreSQL test database and
    // resets (drops + recreates) all tables between files. Parallel workers
    // would race on that shared state, so test files must run serially.
    fileParallelism: false,
    globalSetup: "./tests/global-setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain/**/*.ts"],
      exclude: ["src/domain/value-objects/**/*.ts"],
    },
  },
});