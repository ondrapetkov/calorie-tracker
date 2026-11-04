import { defineConfig, devices } from '@playwright/test'

const PORT = 5180

/**
 * End-to-end tests: the real app in a real browser.
 * Each test gets a fresh browser context, so IndexedDB starts empty and tests don't share data.
 * Run with `npm run e2e`. The browsers match real use: Firefox on the desktop, and WebKit
 * at iPhone size standing in for the Safari home-screen app.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
})
