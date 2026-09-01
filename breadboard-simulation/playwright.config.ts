import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174/circuit/breadboard/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'VITE_DEV_AUTH_BYPASS=true VITE_DISABLE_ENGINE=true pnpm dev --host 127.0.0.1',
    url: 'http://127.0.0.1:5174/circuit/breadboard/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-landscape', use: { ...devices['iPad Pro 11 landscape'], browserName: 'chromium' } },
  ],
})
