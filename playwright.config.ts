import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4321",
    browserName: "chromium",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:4321",
    timeout: 60_000,
    reuseExistingServer: true,
  },
});
