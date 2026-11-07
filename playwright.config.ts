// Playwright configuration for JM Letvest Management App smoke tests
const config = {
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:3000',
    headless: true
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
};

export default config;
