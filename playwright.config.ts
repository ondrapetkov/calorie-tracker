import { defineConfig, devices } from '@playwright/test'

const PORT = 5180

/**
 * End-to-end tests: the real app in a real browser, at phone size.
 * Each test gets a fresh browser context, so IndexedDB starts empty and tests don't share data.
 * Run with `npm run e2e`; WebKit stands in for iPhone Safari.
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
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
  },
})
