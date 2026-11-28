import { test as setup, expect } from '@playwright/test';
import { ALICE_LOGIN, DEMO_PASSWORD } from '../config';

// `test as setup` only renames test, so the report reads "setup".
setup('sign in as alice and save the login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  // storageState writes the context's cookies and local storage to a file.
  await page.context().storageState({ path: ALICE_LOGIN });
});
