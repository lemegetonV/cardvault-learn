import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// toHaveScreenshot compares the page with a picture saved earlier (a baseline).
// The first run has no baseline yet: it saves one and fails, so you can check
// the picture. Later runs compare with it.

test('the sign-in page looks as it did', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveScreenshot('sign-in.png');
});

test('alice’s credit card on the Cards page looks as it did', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
  await page.goto('/cards');

  const card = page.getByRole('listitem').filter({ hasText: '4417' });

  // A picture of one element. "Last used" changes from day to day, so mask
  // hides it behind a coloured box before comparing.
  await expect(card).toHaveScreenshot('credit-card-4417.png', {
    mask: [card.getByTestId('card-last-used')],
  });
});
