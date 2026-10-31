import { defineConfig } from '@playwright/test'

// Usa o Chrome instalado na máquina, sem baixar navegadores extras.
export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  fullyParallel: true,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4174', channel: 'chrome' },
  webServer: { command: 'npm run build && npx vite preview --port 4174 --strictPort', url: 'http://localhost:4174', reuseExistingServer: false, timeout: 120000 },
  projects: [
    { name: 'computador', use: { viewport: { width: 1366, height: 768 } } },
    { name: 'notebook', use: { viewport: { width: 1024, height: 700 } } },
    { name: 'celular', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } }
  ]
})
