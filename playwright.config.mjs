import { defineConfig, devices } from "@playwright/test";

// BP-02 — E2E sur le dossier dist/ réellement déployé (SEC-06), servi en statique.
// `npm run build` doit précéder `npm run test:e2e`.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure", serviceWorkers: "allow" },
  projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx http-server dist -p 4173 -a 127.0.0.1 -c-1 --silent",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
