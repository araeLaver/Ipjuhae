import { defineConfig, devices } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT || '3102'
const hostname = process.env.PLAYWRIGHT_HOST || '127.0.0.1'
const e2eHostURL = process.env.PLAYWRIGHT_BASE_URL || `http://${hostname}:${port}`
const startsLocalServer = !process.env.PLAYWRIGHT_BASE_URL
const e2eDatabaseURL =
  process.env.PLAYWRIGHT_DATABASE_URL ||
  'postgresql://e2e:e2e@127.0.0.1:1/e2e?connect_timeout=1'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: e2eHostURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: startsLocalServer
    ? {
        command: `npm run dev -- --hostname ${hostname} --port ${port}`,
        url: e2eHostURL,
        env: {
          DATABASE_URL: e2eDatabaseURL,
          UPSTASH_REDIS_REST_URL: '',
          UPSTASH_REDIS_REST_TOKEN: '',
        },
        reuseExistingServer: false,
        timeout: 120000,
      }
    : undefined,
})
