// Lesson: Your first test.
// One test, no framework around it: open the sign-in page, sign in as alice,
// and check that her wallet page opens.
import { test, expect } from '@playwright/test';

test('alice can sign in and see her wallet', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill('CardVault-Demo-1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/wallet');
  await expect(page.getByRole('heading', { name: 'Checkout wallet' })).toBeVisible();
});
