// Lesson: Forms and uploads.
// The dispute form on a transaction's page: a select box, a text area and a
// file upload. Opening a dispute changes data, so every test gets its own
// brand-new customer with one purchase, and alice is never touched.
import { test, expect } from '@playwright/test';
import { newCustomerWithPurchase } from './helpers/new-customer';

test.beforeEach(async ({ page, request }) => {
  const customer = await newCustomerWithPurchase(request);

  await page.goto('/login');
  await page.getByLabel('Username').fill(customer.username);
  await page.getByLabel('Password').fill(customer.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  // Open the purchase, then the dispute form under it.
  await page.goto('/wallet/transactions');
  await page.getByRole('link', { name: /Northwind Books/ }).click();
  await page.getByRole('button', { name: 'Dispute' }).click();
});

test('open a dispute with a reason, a note and a receipt', async ({ page }) => {
  await page.getByLabel('Reason').selectOption({ label: 'Wrong amount' });
  await page.getByLabel('Note (optional)').fill('I was charged twice');
  // setInputFiles puts a file in a file field, as if the customer had picked it.
  await page.getByLabel(/Receipt/).setInputFiles('learn/files/receipt.png');
  await page.getByRole('button', { name: 'Open dispute' }).click();

  // A short message confirms it, and the transaction is marked as disputed.
  await expect(page.getByRole('status').filter({ hasText: 'Dispute opened' })).toBeVisible();
  await expect(page.getByTestId('dispute-open-badge')).toHaveText('DISPUTE OPEN');
  await expect(page.getByRole('button', { name: 'Dispute' })).toBeHidden();
});

test('the note counts its characters', async ({ page }) => {
  const note = page.getByLabel('Note (optional)');

  await note.fill('Not my purchase');

  await expect(note).toHaveValue('Not my purchase');
  await expect(page.getByTestId('dispute-note-count')).toHaveText('15/500');
});

test('pick a receipt, then change your mind', async ({ page }) => {
  const receipt = page.getByLabel(/Receipt/);

  await receipt.setInputFiles('learn/files/receipt.png');
  await expect(receipt).toHaveValue(/receipt\.png/);

  // An empty list takes the file out again.
  await receipt.setInputFiles([]);
  await expect(receipt).toHaveValue('');
});
