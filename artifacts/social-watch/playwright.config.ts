import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '../../generated-artifacts/social-watch-browser',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: process.env.VAULT_TEST_BASE_URL || (process.env.CI ? 'http://127.0.0.1:4173' : 'http://127.0.0.1:80'),
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  // Replit uses its existing managed workflow/proxy. CI owns a disposable
  // Vite server; none of the tests or fault controls enter the deployed bundle.
  webServer: process.env.CI && !process.env.VAULT_TEST_BASE_URL ? {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    env: { PORT: '4173', BASE_PATH: '/' },
    reuseExistingServer: false,
  } : undefined,
});
