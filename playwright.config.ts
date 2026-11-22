import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const baseURL = "http://127.0.0.1:3219";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 120000,
  expect: { timeout: 20000 },
  use: {
    baseURL,
    actionTimeout: 20000,
    navigationTimeout: 40000,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3219",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      OPENAI_API_KEY: "",
      OFFICER_PASSWORD: "browser-test-password",
      OFFICER_SESSION_SECRET: "browser-test-isolated-server-secret-32bytes",
      LEAKLEDGER_DATA_DIR: mkdtempSync(join(tmpdir(), "leakledger-e2e-")),
    },
  },
});
