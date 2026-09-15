import { defineConfig } from "vitest/config";
import { config as dotenvConfig } from "dotenv";

// Ensure DB/config resolves to the test database for any test that touches it.
process.env.APP_ENV = "test";
const parsedEnv = dotenvConfig().parsed ?? {};
// Strip OAuth credentials so tests control them explicitly, not from .env.
delete parsedEnv.GOOGLE_CLIENT_ID;
delete parsedEnv.GOOGLE_CLIENT_SECRET;
delete parsedEnv.GOOGLE_CALLBACK_URL;
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GOOGLE_CALLBACK_URL;

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    env: { ...parsedEnv, APP_ENV: "test" },
    fileParallelism: false,
    maxWorkers: 1,
    globalSetup: "./tests/global-setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/domain/**/*.ts"],
      exclude: ["src/domain/value-objects/**/*.ts"],
    },
  },
});
