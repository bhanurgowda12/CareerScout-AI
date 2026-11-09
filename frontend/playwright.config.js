import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  expect: { timeout: 15_000 },
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      VITE_API_BASE_URL: 'http://127.0.0.1:8000',
      VITE_FIREBASE_API_KEY: 'playwright-public-test-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'playwright.example.test',
      VITE_FIREBASE_PROJECT_ID: 'demo-careerscout-ai',
      VITE_FIREBASE_STORAGE_BUCKET: 'demo-careerscout-ai.appspot.com',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
      VITE_FIREBASE_APP_ID: '1:123456789012:web:playwrighttest',
      VITE_FIREBASE_APP_CHECK_SITE_KEY: '',
      VITE_FIREBASE_APP_CHECK_DEBUG: 'false',
      VITE_FIREBASE_USE_EMULATORS: 'true',
    },
  },
});
