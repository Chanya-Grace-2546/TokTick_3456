import { defineConfig, devices } from "@playwright/test";

// Lab 2 Issue 7 — E2E testing, visual/responsive inspection.
// Three projects mirror the handout's exact breakpoints (§8.7):
//   Desktop  >= 992px
//   Tablet    768-991px
//   Mobile   <  768px
//
// IMPORTANT: this only starts the CLIENT dev server automatically. The
// BACKEND (server/) must already be running separately, with the database
// migrated and seeded — Playwright can't safely manage a real Postgres
// database's lifecycle, so that's a manual prerequisite, not automated.
export default defineConfig({
  testDir: "./lab-02",
  fullyParallel: false, // the flow test creates real DB rows; keep it sequential
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },

  webServer: {
    command: "npm run dev --prefix ../client",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "tablet",
      use: { ...devices["Desktop Chrome"], viewport: { width: 850, height: 1100 } },
    },
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
  ],
});
