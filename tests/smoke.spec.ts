// Playwright E2E smoke test suite for JM Letvest Management App
// Executed in CI via `npx playwright test` against local demo mode (fictional fixtures only).

export const SMOKE_SCENARIOS = [
  {
    name: 'loads JM Letvest HMO operations workspace and displays portfolio KPIs',
    path: '/',
    expectedHeadings: ['JM Letvest', 'Portfolio', 'Compliance']
  },
  {
    name: 'displays statutory certificate register and 30-day expiry warnings',
    path: '/',
    expectedCertificates: ['CP12', 'EICR', 'PAT', 'EPC', 'HMO Licence']
  }
];
