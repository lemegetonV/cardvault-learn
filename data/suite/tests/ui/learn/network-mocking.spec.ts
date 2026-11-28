import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// The address the transactions page asks for its list.
const TRANSACTIONS_API = '**/api/wallet/transactions?*';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
});

test('an empty list shows the empty message', async ({ page }) => {
  // page.route catches matching requests. fulfill answers them with our own
  // response, so the request never reaches CardVault.
  await page.route(TRANSACTIONS_API, (route) =>
    route.fulfill({ json: { items: [], next_cursor: null } }),
  );

  await page.goto('/wallet/transactions');

  await expect(page.getByText('No transactions match these filters.')).toBeVisible();
});

test('a server error shows an error and a Try again button', async ({ page }) => {
  await page.route(TRANSACTIONS_API, (route) =>
    route.fulfill({
      status: 503,
      json: { error_code: 'UNAVAILABLE', message: 'The service is not available' },
    }),
  );

  await page.goto('/wallet/transactions');

  const error = page.getByTestId('error-state');
  await expect(error).toContainText('The service is not available (UNAVAILABLE)');

  // Stop catching requests. The next request reaches the real service again.
  await page.unroute(TRANSACTIONS_API);
  await error.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('txn-row')).toHaveCount(20);
});

test('change one field in the real response', async ({ page }) => {
  await page.route(TRANSACTIONS_API, async (route) => {
    // Let the request through, wait for the real answer, change it, pass it on.
    const response = await route.fetch();
    const body = await response.json();
    body.items[0].merchant_name = 'A shop with a very long name that goes on and on';
    await route.fulfill({ response, json: body });
  });

  await page.goto('/wallet/transactions');

  await expect(page.getByTestId('txn-row').first()).toContainText('A shop with a very long name');
  await expect(page.getByTestId('txn-row')).toHaveCount(20);
});
