import { defineConfig, devices } from "@playwright/test";

import { E2E_PORT, e2eDatabaseUrl } from "./tests/e2e/env";

const baseURL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  workers: 4,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-1920",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: "laptop-1366",
      testMatch: /layout\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "mobile-390",
      testMatch: /layout\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // Dev server riêng cho E2E: CSDL _e2e, thư mục build riêng, cổng riêng
    command: `npx next dev --port ${E2E_PORT}`,
    url: `${baseURL}/dang-nhap`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: e2eDatabaseUrl(), NEXT_DIST_DIR: ".next-e2e", COOKIE_SECURE: "false" },
  },
});
