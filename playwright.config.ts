import { config as dotenv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";
import { lokalnyStack } from "./tests/e2e/pomocnicze/lokalny-stack";

dotenv({ path: ".env.local" });

/**
 * E2E na lokalnym Supabase (Docker) i osobnym porcie, żeby nie dotykać projektu w chmurze
 * ani zwykłego `pnpm dev`. Dwie szerokości z SPEC rozdz. 7.5: 390 px i 1440 px, oba na Chromium.
 */
const PORT = 3100;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;
process.env.E2E_BASE_URL = baseURL;
const stack = process.env.PLAYWRIGHT_BASE_URL ? null : lokalnyStack();

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/pomocnicze/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
  },
  projects: [
    { name: "przygotowanie", testMatch: /.*\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } }, dependencies: ["przygotowanie"] },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, dependencies: ["przygotowanie"] },
  ],
  webServer: stack
    ? {
        command: `pnpm dev -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_APP_URL: baseURL,
          SUPABASE_URL: stack.apiUrl,
          SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
          SUPABASE_SECRET_KEY: stack.secretKey,
          // Import z Dysku na atrapie w pamięci (lib/drive/atrapa.ts): bez konta usługi, bez sieci.
          DRIVE_ATRAPA: "1",
          GOOGLE_DRIVE_ROOT_FOLDER_ID: "atrapa-materialy-klientow",
        },
      }
    : undefined,
});
