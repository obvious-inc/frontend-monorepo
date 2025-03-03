import { defineConfig } from "@playwright/test";

const APP_SERVER_PORT = process.env.APP_SERVER_PORT || 9000;

export default defineConfig({
  testDir: "./src/e2e-tests",
  outputDir: "./test-results",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    // ["html"],
    ["list"],
  ],
  use: {
    baseURL: `http://localhost:${APP_SERVER_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    // Use prod build—dev is too slow
    command: `pnpm -F nouns-camp build && PORT=${APP_SERVER_PORT} pnpm -F nouns-camp start`,
    url: `http://localhost:${APP_SERVER_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
    // {
    //   name: "firefox",
    //   use: { browserName: "firefox" },
    // },
    // {
    //   name: "webkit",
    //   use: { browserName: "webkit" },
    // },
  ],
});
