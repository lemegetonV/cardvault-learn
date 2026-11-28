import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DEMO_PASSWORD } from '../config';
import { newCustomerWithCard } from './helpers/new-customer';

async function signIn(page: Page, username: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
}

test('Wallet help opens in a new tab', async ({ page }) => {
  await signIn(page, 'alice', DEMO_PASSWORD);

  // Start waiting for the new tab before the click that opens it.
  const newTab = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Wallet help' }).click();
  const help = await newTab;

  await expect(help.getByRole('heading', { name: 'Checkout wallet help' })).toBeVisible();
  // The first tab is still there, on the wallet page.
  await expect(page).toHaveURL('/wallet');
});

test('cancel the browser’s own confirm box: nothing changes', async ({ page }) => {
  await signIn(page, 'alice', DEMO_PASSWORD);
  await page.goto('/cards');
  const card = page.getByRole('listitem').filter({ hasText: '4417' });

  // Say what to do with the next dialog before the click that opens it.
  // The handler only notes the question and presses Cancel; the check comes after.
  let question = '';
  page.once('dialog', async (dialog) => {
    question = dialog.message();
    await dialog.dismiss(); // the Cancel button
  });
  await card.getByRole('button', { name: 'Close' }).click();

  expect(question).toBe('Close the credit card ending 4417? This cannot be undone.');

  await expect(card.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(card).toContainText('ACTIVE');
});

test('accept the confirm box: the card is closed', async ({ page, request }) => {
  // Closing a card cannot be undone, so this test uses its own new customer.
  const customer = await newCustomerWithCard(request);
  await signIn(page, customer.username, customer.password);
  await page.goto('/cards');

  page.once('dialog', (dialog) => dialog.accept()); // the OK button
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Card closed' })).toBeVisible();
  await expect(page.getByTestId('card-list')).toContainText('CLOSED');
});

test('the opt-out box is part of the page, so it is tested like the page', async ({ page }) => {
  await signIn(page, 'alice', DEMO_PASSWORD);

  await page.getByRole('button', { name: 'Opt out' }).click();
  const dialog = page.getByRole('dialog', { name: 'Opt out of the wallet?' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('Export CSV downloads a file with every transaction', async ({ page }) => {
  await signIn(page, 'alice', DEMO_PASSWORD);
  await page.goto('/wallet/transactions');

  // Start waiting for the download before the click that starts it.
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe('wallet-transactions-all-all.csv');

  // Read the downloaded file and split it into lines.
  const text = readFileSync(await download.path(), 'utf-8');
  const lines = text.trim().split('\n');
  expect(lines[0]).toContain('merchant_name');
  expect(lines.length).toBe(1 + 55); // a header line, then alice's 55 transactions
});
