import { test, expect, devices } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// devices holds ready-made settings for real phones and tablets: screen size,
// pixel density, touch and the browser's user agent. This file pretends to be
// a Pixel 7 phone.
test.use({ ...devices['Pixel 7'] });

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  // Wait until the wallet has loaded alice's cards. Until the page has
  // finished starting up, the Menu button may not respond to a click yet.
  await expect(page.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
});

test('tap the Menu button to reach the other pages', async ({ page }) => {
  // tap() is a touch, the way a finger presses a phone screen.
  await page.getByRole('button', { name: 'Menu' }).tap();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cards' }).tap();

  await expect(page).toHaveURL('/cards');
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
});

test('the page never scrolls sideways', async ({ page }) => {
  await page.goto('/wallet/transactions');
  await expect(page.getByTestId('txn-row')).toHaveCount(20);

  // page.evaluate runs a small function inside the page and returns its result.
  const tooWide = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(tooWide).toBe(false);
});
