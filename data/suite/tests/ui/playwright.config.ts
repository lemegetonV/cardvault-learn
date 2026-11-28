import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './config';

// The one settings file Playwright reads before every run.
export default defineConfig({
  // Run every test for at most 30 seconds.
  timeout: 30_000,

  // Retry a failed test once on CI only. Locally, a failure stays a failure.
  retries: process.env.CI ? 1 : 0,

  // What to print while tests run, and the HTML report to open afterwards.
  reporter: [['list'], ['html', { open: 'never' }]],

  // Settings every test gets.
  use: {
    baseURL: BASE_URL, // page.goto('/login') opens BASE_URL + '/login'
    trace: 'retain-on-failure', // keep a full recording of each failed test
    screenshot: 'only-on-failure',
  },

  // A project is one group of tests with its own settings.
  projects: [
    {
      // Runs first: signs in once and saves the login to a file (lesson: Logging in once).
      name: 'setup',
      testDir: './learn',
      testMatch: '*.setup.ts',
    },
    {
      // The small tests in learn/, one file per lesson, in a desktop Chrome window.
      name: 'learn',
      testDir: './learn',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'], // run the setup project before this one
    },
  ],
});
