// Lesson: Actions and auto-waiting.
// The filters on the transactions page use most kinds of form control:
// a select box, checkboxes, date fields and buttons. Filtering only reads
// data, so these tests change nothing.
import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD } from '../config';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  // press() types one key. Enter in a form field sends the form.
  await page.getByLabel('Password').press('Enter');
  await page.getByRole('link', { name: 'Transactions' }).first().click();
});

test('choose a status from the select box', async ({ page }) => {
  await page.getByLabel('Status').selectOption('SETTLED');
  await page.getByRole('button', { name: 'Apply' }).click();

  // The filters go into the page address, so a filtered list can be shared.
  await expect(page).toHaveURL(/status=SETTLED/);
});

test('tick and untick a card', async ({ page }) => {
  const credit = page.getByRole('checkbox', { name: 'CREDIT •••• 4417' });

  await credit.check();
  await expect(credit).toBeChecked();

  await credit.uncheck();
  await expect(credit).not.toBeChecked();
});

test('type dates into date fields', async ({ page }) => {
  // A date field takes its value as year-month-day, whatever it shows on screen.
  await page.getByLabel('From').fill('2026-02-01');
  await page.getByLabel('To').fill('2026-01-01');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText('The From date must not be after the To date.')).toBeVisible();
});

test('clear the filters with a click', async ({ page }) => {
  await page.getByLabel('Status').selectOption('DECLINED');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page).toHaveURL(/status=DECLINED/);

  await page.getByRole('button', { name: 'Clear' }).click();

  await expect(page).toHaveURL('/wallet/transactions');
  await expect(page.getByLabel('Status')).toHaveValue('');
});
