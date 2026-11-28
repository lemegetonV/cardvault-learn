import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

test(
  'the CSV export, with evidence for the report',
  // An annotation is a note shown with the test in the HTML report.
  { tag: '@export', annotation: { type: 'feature', description: 'Transactions: Export CSV' } },
  async ({ page }, testInfo) => {
    await test.step('sign in as alice', async () => {
      await page.goto('/login');
      await page.getByLabel('Username').fill('alice');
      await page.getByLabel('Password').fill(DEMO_PASSWORD);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/wallet');
    });

    await test.step('filter to settled transactions', async () => {
      await page.goto('/wallet/transactions?status=SETTLED');
      await expect(page.getByTestId('txn-row').first()).toBeVisible();
    });

    await test.step('export and keep the file', async () => {
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export CSV' }).click();
      const download = await downloading;

      // Attach the downloaded file, so anyone reading the report can open it.
      await testInfo.attach('export.csv', { path: await download.path(), contentType: 'text/csv' });
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    });
  },
);
