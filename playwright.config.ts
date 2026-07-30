import { defineConfig, devices } from "@playwright/test";

// Tests mutate shared DB state (create people, statements) — run serially,
// matching the "single-admin personal app" simplicity this repo favors
// (see CLAUDE.md's "Keep it simple" rule) rather than adding per-test
// data isolation machinery.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  // Backstop for the 8+ specs whose own end-of-body cleanup only runs when
  // every earlier assertion passes: sweeps any Person/CreditCard row left
  // behind by a failed run (or a killed process, via globalSetup) so leaked
  // "E2E "-prefixed fixture data never survives into real admin usage of
  // the same local Postgres database. See tests/e2e/global-cleanup.ts.
  globalSetup: "./tests/e2e/global-cleanup.ts",
  globalTeardown: "./tests/e2e/global-cleanup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // Mirrors .claude/skills/run-debt-tracker/smoke.sh: assumes Postgres is
  // already up on :5432 (started separately via `docker compose up -d`),
  // reuses an already-running dev server if one answers on :3000.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
