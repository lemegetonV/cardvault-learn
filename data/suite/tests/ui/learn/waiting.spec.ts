// Lesson: Waiting the right way.
// The transactions page loads 20 rows at a time from the server. These tests
// wait for the thing that matters, never for a fixed number of seconds.
import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for the new page to open before going on.
  await page.waitForURL('/wallet');
});

test('wait for the rows, not for the clock', async ({ page }) => {
  await page.goto('/wallet/transactions');

  // While the rows load, the page shows "Loading transactions…".
  // toHaveCount keeps checking until 20 rows are there.
  await expect(page.getByTestId('txn-row')).toHaveCount(20);
  await expect(page.getByText('Loading transactions')).not.toBeVisible();
});

test('wait for the server to answer', async ({ page }) => {
  await page.goto('/wallet/transactions');
  await expect(page.getByTestId('txn-row')).toHaveCount(20);

  // Start listening before the click, so the answer cannot arrive unnoticed.
  const answer = page.waitForResponse('**/api/wallet/transactions?*');
  await page.getByRole('button', { name: 'Load more' }).click();
  const response = await answer;

  expect(response.status()).toBe(200);
  await expect(page.getByTestId('txn-row')).toHaveCount(40);
});

test('keep loading until there is nothing more', async ({ page }) => {
  await page.goto('/wallet/transactions');
  const loadMore = page.getByRole('button', { name: 'Load more' });

  await loadMore.click(); // rows 21 to 40
  await expect(page.getByTestId('txn-row')).toHaveCount(40);
  await loadMore.click(); // the last rows

  // alice has 55 transactions. When they are all shown, the button goes away.
  await expect(page.getByTestId('txn-row')).toHaveCount(55);
  await expect(loadMore).toBeHidden();
});
