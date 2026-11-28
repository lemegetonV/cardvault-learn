import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './config';

// A second settings file, only for the screenshot tests in visual/ (lesson: Visual comparison).
//
// A screenshot depends on the machine that takes it: fonts and the operating
// system change a few pixels. So these tests always run inside Playwright's own
// Docker image, the same on every computer and on CI, and the saved pictures
// were made in that image too. Run them with:
//
//   npm run visual
export default defineConfig({
  testDir: './visual',
  outputDir: 'visual-results',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'visual-report' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'visual',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
