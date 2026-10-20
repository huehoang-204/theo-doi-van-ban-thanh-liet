import path from "node:path";

import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

import { testDatabaseUrl } from "./tests/integration/global-setup";

// Integration test: chạy server action/truy vấn thật trên PostgreSQL (CSDL <db>_test).
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "tests/integration/empty-module.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    env: { TZ: "Asia/Ho_Chi_Minh", DATABASE_URL: testDatabaseUrl() },
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
