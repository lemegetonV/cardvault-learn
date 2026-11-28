import { test, expect, Page } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

async function signInAsAlice(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
}

test.describe('the session clock', () => {
  test.beforeEach(async ({ page }) => {
    // Give the page a fake clock before it opens, so the test can move time on.
    await page.clock.install();

    // The wallet page asks the server how long the session has left, then
    // starts its timer. Wait for that answer, or time could move on too early.
    const session = page.waitForResponse('**/api/auth/session');
    await signInAsAlice(page);
    await session;
  });

  test('a warning appears one minute before the session ends', async ({ page }) => {
    // Jump 14 minutes ahead, running every timer that falls in between.
    await page.clock.fastForward('14:00');

    const warning = page.getByRole('alertdialog', { name: 'Your session is about to end' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Signing out in');

    await warning.getByRole('button', { name: 'Stay signed in' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'You are still signed in' })).toBeVisible();
    await expect(warning).toBeHidden();
  });

  test('after 15 minutes the customer is signed out', async ({ page }) => {
    // A few seconds past 15 minutes: the session timer starts a moment after
    // the page opens, so exactly 15:00 can land just before the deadline.
    await page.clock.fastForward('15:05');

    await expect(page).toHaveURL(/\/login\?reason=timeout/);
    await expect(page.getByText('You were signed out after 15 minutes.')).toBeVisible();
  });
});

// One made-up purchase at a known moment: 14:30 UTC on 1 March 2026, $30.00.
// The test supplies it (see the network mocking lesson), so the expected
// text below can be worked out by hand.
const ONE_PURCHASE = {
  items: [
    {
      txn_id: '7a000000-0000-4000-8000-0000000000ff',
      card_id: 'ca4d0000-a11c-4000-8000-000000000001',
      merchant_name: 'Northwind Books',
      status: 'SETTLED',
      amount: 3000,
      cleared_amount: 3000,
      currency: 'USD',
      occurred_at: '2026-03-01T14:30:00Z',
      open_dispute_id: null,
    },
  ],
  next_cursor: null,
};

test.describe('a customer in India', () => {
  // The browser's language and time zone, for every test in this group.
  test.use({ locale: 'en-IN', timezoneId: 'Asia/Kolkata' });

  test('sees the time in India Standard Time', async ({ page }) => {
    await page.route('**/api/wallet/transactions?*', (route) => route.fulfill({ json: ONE_PURCHASE }));
    await signInAsAlice(page);
    await page.goto('/wallet/transactions');

    // 14:30 UTC is 20:00 in India (UTC+5:30).
    await expect(page.getByTestId('txn-time')).toContainText('1 Mar 2026, 8:00 pm');
  });
});

test.describe('a customer in New York', () => {
  test.use({ locale: 'en-US', timezoneId: 'America/New_York' });

  test('sees the time in Eastern Time', async ({ page }) => {
    await page.route('**/api/wallet/transactions?*', (route) => route.fulfill({ json: ONE_PURCHASE }));
    await signInAsAlice(page);
    await page.goto('/wallet/transactions');

    // 14:30 UTC is 09:30 in New York in March (UTC-5).
    await expect(page.getByTestId('txn-time')).toContainText('Mar 1, 2026, 9:30 AM');
  });
});
