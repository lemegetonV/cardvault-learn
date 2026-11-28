import { test, expect } from '@playwright/test';
import { ALICE_LOGIN } from '../config';

// Every test in this file starts with alice's saved login, so it begins
// signed in, without opening the sign-in page at all.
test.use({ storageState: ALICE_LOGIN });

test('open the Cards page straight away, already signed in', async ({ page }) => {
  await page.goto('/cards');

  await expect(page).toHaveURL('/cards');
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
});

test('the saved login belongs to alice', async ({ page }) => {
  await page.goto('/profile');

  await expect(page.getByTestId('profile-email')).toHaveValue('alice@example.com');
});
