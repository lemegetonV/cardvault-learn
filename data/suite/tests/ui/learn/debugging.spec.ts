import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

// test.step gives a group of lines a name. The name shows in the HTML report
// and in the trace viewer, so a long test reads like a list of steps.
test('the transactions page loads without browser errors', async ({ page }) => {
  // Collect every error the page reports while the test runs.
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await test.step('sign in as alice', async () => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('alice');
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/wallet');
  });

  await test.step('open the transactions page', async () => {
    await page.goto('/wallet/transactions');
    await expect(page.getByTestId('txn-row')).toHaveCount(20);
  });

  // A page can look fine and still throw errors in the background.
  expect(errors).toEqual([]);
});
