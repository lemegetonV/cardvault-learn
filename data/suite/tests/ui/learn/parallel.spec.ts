import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// By default, the tests in one file run one after another in one worker.
// This line lets the tests in this file run at the same time in several workers.
test.describe.configure({ mode: 'parallel' });

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
});

// Each test only reads alice's data, so they cannot get in each other's way.
for (const path of ['/wallet', '/wallet/transactions', '/cards', '/profile']) {
  test(`the page ${path} opens`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // parallelIndex says which worker ran this test: 0, 1, 2 ...
    console.log(`worker ${testInfo.parallelIndex} opened ${path}`);
  });
}
